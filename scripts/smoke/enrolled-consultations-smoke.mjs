import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createAuthedContext,
  createDiagnostics,
  jsonRoute,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

const TEST_DATE = '2026-06-24';

function makeConsultation(overrides = {}) {
  return {
    id: 210,
    academy_id: 1,
    consultation_type: 'learning',
    learning_type: 'regular',
    parent_name: '',
    parent_phone: '',
    student_name: '김진우',
    student_phone: '010-1111-2222',
    student_grade: '고2',
    student_school: '일산고',
    gender: 'male',
    linked_student_id: 41,
    linked_student_name: '김진우',
    linked_student_grade: '고2',
    preferred_date: TEST_DATE,
    preferred_time: '09:30',
    status: 'pending',
    admin_notes: '6월 모평 이후 상담',
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    ...overrides,
  };
}

function makeState(mode) {
  return {
    createPayload: null,
    hits: [],
    mode,
    updatePayload: null,
  };
}

function mockScores(exam) {
  return {
    success: true,
    matched: true,
    scores: {
      year: '2026',
      exam,
      국어: { 등급: '2', 표준점수: 128 },
      수학: { 등급: '1', 표준점수: 134 },
      영어: { 등급: '1' },
      탐구1: { 등급: '2', 선택과목: '생활과윤리' },
      탐구2: { 등급: '3', 선택과목: '사회문화' },
      한국사: { 등급: '1' },
    },
  };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'supermax.kr';

    if (!isApi) return route.continue();

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/consultations/settings/info') {
      return jsonRoute(route, {
        academy: { id: 1, name: state.mode === 'missing-hours' ? 'PACA 강남' : 'PACA 일산' },
        settings: { isEnabled: true, slotDuration: 30, advanceDays: 30 },
        weeklyHours: state.mode === 'missing-hours'
          ? []
          : [{ dayOfWeek: 3, isAvailable: true, startTime: '09:00', endTime: '11:00' }],
        blockedSlots: [],
      });
    }

    if (method === 'GET' && path === '/consultations/booked-times') {
      return jsonRoute(route, { date: url.searchParams.get('date') || TEST_DATE, bookedTimes: ['10:00'] });
    }

    if (method === 'GET' && path === '/consultations') {
      const isSidebarCount = url.searchParams.get('limit') === '1';
      if (state.mode === 'list-error' && !isSidebarCount) {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        consultations: [
          makeConsultation(),
          makeConsultation({
            id: 211,
            learning_type: 'admission',
            preferred_time: '10:30',
            status: 'confirmed',
            student_name: '박서연',
            student_grade: '고3',
          }),
        ],
        pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
        stats: { total: 2, pending: 1, confirmed: 1, completed: 0, cancelled: 0, no_show: 0 },
      });
    }

    if (method === 'GET' && path === '/students') {
      return jsonRoute(route, {
        students: [
          { id: 41, name: '김진우', grade: '고2' },
          { id: 42, name: '박서연', grade: '고3' },
        ],
      });
    }

    if (method === 'GET' && path.startsWith('/jungsi/scores/')) {
      return jsonRoute(route, mockScores(url.searchParams.get('exam') || '3월'));
    }

    if (method === 'POST' && path === '/consultations/learning') {
      state.createPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'created', id: 300 });
    }

    if (method === 'PUT' && path === '/consultations/210') {
      state.updatePayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'updated' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createEnrolledPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function selectOption(page, label, optionName) {
  await page.getByLabel(label).click();
  await page.getByText(optionName, { exact: true }).last().click();
}

async function openCreateDialog(page) {
  await page.goto('/consultations/enrolled', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '재원생상담', exact: true }).waitFor();
  await waitForEnrolledShell(page);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.getByRole('button', { name: '재원생상담 등록', exact: true }).click();
  await page.getByRole('heading', { name: '재원생상담 등록' }).waitFor();
}

async function waitForEnrolledShell(page) {
  await page.getByTestId('enrolled-consultations-operations-workspace').waitFor();
  const board = page.getByTestId('enrolled-consultations-work-queue');
  await board.waitFor();
  await board.getByText('재원생상담 운영 보드').waitFor();
  await board.getByText('확인 대기').first().waitFor();
}

async function waitForHit(state, expected) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (state.hits.some((hit) => hit.includes(expected))) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`missing API hit containing ${expected}: ${state.hits.join(' | ')}`);
}

async function runDesktop(browser) {
  const result = await createEnrolledPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/consultations/enrolled', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '재원생상담', exact: true }).waitFor();
  await waitForEnrolledShell(page);
  await page.getByText('Learning Desk').waitFor();
  const board = page.getByTestId('enrolled-consultations-work-queue');
  await board.getByText('확인 대기 1건').waitFor();
  await board.getByText('일정 확정 1건').waitFor();
  const pendingFilter = board.getByRole('button', { name: '확인 대기 보기' });
  await pendingFilter.click();
  if ((await pendingFilter.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('enrolled consultations pending queue filter is not active');
  }
  await waitForHit(state, 'status=pending');
  const confirmedFilter = board.getByRole('button', { name: '일정 확정 보기' });
  await confirmedFilter.click();
  if ((await confirmedFilter.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('enrolled consultations confirmed queue filter is not active');
  }
  await waitForHit(state, 'status=confirmed');
  await board.getByRole('link', { name: '상담 달력' }).waitFor();
  if ((await board.getByRole('link', { name: '상담 달력' }).getAttribute('href')) !== '/consultations/calendar?type=learning') {
    throw new Error('learning calendar quick link mismatch');
  }
  if ((await board.getByRole('link', { name: '상담 시간 설정' }).getAttribute('href')) !== '/consultations/settings') {
    throw new Error('consultation settings quick link mismatch');
  }
  await page.getByText('김진우').first().waitFor();
  await page.getByPlaceholder('학생명, 학년 검색...').fill('박서연');
  await page.getByText('박서연').first().waitFor();
  await assertNoRawVisibleText(page, 'enrolled consultations desktop');
  await assertNoHorizontalOverflow(page, 'enrolled consultations desktop');
  await page.screenshot({ path: '/Users/etlab/paca-enrolled-consultations-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runCreateHappyPath(browser) {
  const result = await createEnrolledPage(browser, 'success');
  const { context, page, state } = result;

  await openCreateDialog(page);
  await page.getByLabel('학생 선택').fill('김진우');
  await page.getByRole('button', { name: '김진우 (고2)', exact: true }).click();
  await page.getByLabel('상담일').fill(TEST_DATE);
  await selectOption(page, '시간', '09:30');
  await selectOption(page, '상담 유형', '진학 상담');
  await page.getByRole('button', { name: '등록', exact: true }).last().click();
  await page.getByText('재원생 상담이 등록되었습니다.').waitFor();

  if (!state.createPayload) throw new Error('learning consultation payload was not sent');
  if (state.createPayload.studentId !== 41) {
    throw new Error(`studentId mismatch: ${state.createPayload.studentId}`);
  }
  if (state.createPayload.preferredTime !== '09:30') {
    throw new Error(`preferredTime mismatch: ${state.createPayload.preferredTime}`);
  }
  if (state.createPayload.learningType !== 'admission') {
    throw new Error(`learningType mismatch: ${state.createPayload.learningType}`);
  }

  await assertNoRawVisibleText(page, 'enrolled consultations create');
  await assertNoHorizontalOverflow(page, 'enrolled consultations create');
  await page.screenshot({ path: '/Users/etlab/paca-enrolled-consultations-create.png', fullPage: true });

  await context.close();
  return result;
}

async function runMissingHours(browser) {
  const result = await createEnrolledPage(browser, 'missing-hours', { width: 390, height: 844 });
  const { context, page } = result;

  await openCreateDialog(page);
  await page.getByLabel('상담일').fill(TEST_DATE);
  await page.getByText('상담 가능 시간이 설정되지 않았습니다').waitFor();
  await page.getByRole('link', { name: '상담 설정으로 이동' }).waitFor();
  await assertNoRawVisibleText(page, 'enrolled consultations missing hours');
  await assertNoHorizontalOverflow(page, 'enrolled consultations missing hours');
  await page.screenshot({ path: '/Users/etlab/paca-enrolled-consultations-missing-hours.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createEnrolledPage(browser, 'list-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/consultations/enrolled', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '재원생상담 목록을 불러오지 못했습니다' }).waitFor();
  await assertNoRawVisibleText(page, 'enrolled consultations load error');
  await assertNoHorizontalOverflow(page, 'enrolled consultations load error');
  await page.screenshot({ path: '/Users/etlab/paca-enrolled-consultations-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobile(browser) {
  const result = await createEnrolledPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/consultations/enrolled', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '재원생상담', exact: true }).waitFor();
  await waitForEnrolledShell(page);
  await page.getByText('Learning Desk').waitFor();
  await page.getByText('상담 시간 설정 정상').waitFor();
  await page.getByRole('button', { name: /김진우/ }).first().waitFor();
  await assertNoRawVisibleText(page, 'enrolled consultations mobile');
  await assertNoHorizontalOverflow(page, 'enrolled consultations mobile');
  await page.screenshot({ path: '/Users/etlab/paca-enrolled-consultations-mobile.png', fullPage: true });

  await context.close();
  return result;
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const desktop = await runDesktop(browser);
    const mobile = await runMobile(browser);
    const createHappyPath = await runCreateHappyPath(browser);
    const missingHours = await runMissingHours(browser);
    const loadError = await runLoadError(browser);
    [desktop, mobile, createHappyPath, missingHours, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      createPayload: createHappyPath.state.createPayload,
      desktopHits: desktop.state.hits,
      errorConsoleErrors: loadError.diagnostics.consoleErrors,
      errorHits: loadError.state.hits,
      missingHoursHits: missingHours.state.hits,
      mobileHits: mobile.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
