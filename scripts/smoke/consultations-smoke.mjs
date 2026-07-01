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

function makeConsultation(overrides = {}) {
  return {
    id: 510,
    academy_id: 1,
    consultation_type: 'new_registration',
    parent_name: '김진우 학부모',
    parent_phone: '010-3333-4444',
    student_name: '김진우',
    student_phone: '010-1111-2222',
    student_grade: '고2',
    student_school: '일산고',
    gender: 'male',
    preferred_date: '2026-06-24',
    preferred_time: '10:30',
    status: 'pending',
    admin_notes: '첫 방문 상담',
    inquiry_content: '정시 체대 상담 희망',
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    ...overrides,
  };
}

function makeState(mode = 'success') {
  return { hits: [], mode };
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
        academy: { id: 1, name: 'PACA 일산' },
        settings: { isEnabled: true, slotDuration: 30, advanceDays: 30 },
        weeklyHours: [{ dayOfWeek: 3, isAvailable: true, startTime: '09:00', endTime: '12:00' }],
        blockedSlots: [],
      });
    }

    if (method === 'GET' && path === '/consultations') {
      const isSidebarCount = url.searchParams.get('limit') === '1';
      if (state.mode === 'load-error' && !isSidebarCount) {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        consultations: [
          makeConsultation(),
          makeConsultation({
            id: 511,
            consultation_type: 'learning',
            learning_type: 'regular',
            parent_name: '',
            parent_phone: '',
            student_name: '박서연',
            student_phone: '010-5555-6666',
            student_grade: '고3',
            preferred_time: '11:00',
            status: 'confirmed',
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

    if (method === 'GET' && path === '/consultations/booked-times') {
      return jsonRoute(route, { date: url.searchParams.get('date') || '2026-06-24', bookedTimes: ['10:30'] });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createConsultationsPage(browser, viewport = { width: 1365, height: 900 }, mode = 'success') {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function waitForHit(state, expected) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (state.hits.some((hit) => hit.includes(expected))) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`missing API hit containing ${expected}: ${state.hits.join(' | ')}`);
}

async function runDesktop(browser) {
  const result = await createConsultationsPage(browser);
  const { context, diagnostics, page, state } = result;

  await page.goto('/consultations', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 관리' }).waitFor();
  await page.getByTestId('consultations-operations-workspace').waitFor();
  await page.getByTestId('consultations-filter-bar').waitFor();
  const desktopQueue = page.getByTestId('consultations-work-queue');
  await desktopQueue.waitFor();
  await page.getByText('오늘 상담 운영 보드').waitFor();
  await desktopQueue.getByText('확인 필요', { exact: true }).waitFor();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  try {
    await page.getByText('김진우').first().waitFor();
    await page.getByText('박서연').first().waitFor();
    await desktopQueue.getByText('1건').first().waitFor();
  } catch (error) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 1200);
    throw new Error(`consultation rows did not render; hits=${JSON.stringify(state.hits)}; pageErrors=${JSON.stringify(diagnostics.pageErrors)}; consoleErrors=${JSON.stringify(diagnostics.consoleErrors)}; body=${bodyText}; cause=${error}`);
  }
  const pendingFilter = desktopQueue.getByRole('button', { name: '확인 필요 보기' });
  await pendingFilter.click();
  if ((await pendingFilter.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('consultations pending queue filter is not active');
  }
  await waitForHit(state, 'status=pending');
  const confirmedFilter = desktopQueue.getByRole('button', { name: '일정 확정 보기' });
  await confirmedFilter.click();
  if ((await confirmedFilter.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('consultations confirmed queue filter is not active');
  }
  await waitForHit(state, 'status=confirmed');
  await page.getByRole('button', { name: /직접 등록/ }).waitFor();
  await assertNoRawVisibleText(page, 'consultations desktop');
  await assertNoHorizontalOverflow(page, 'consultations desktop');
  await page.screenshot({ path: '/Users/etlab/paca-consultations-desktop.png', fullPage: true });

  await page.getByText('010-1111-2222').click();
  await page.getByText('상담 신청 상세').waitFor();
  await page.getByText('정시 체대 상담 희망').waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-consultations-detail-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '체험 등록' }).click();
  await page.getByRole('heading', { name: '체험 수업 일정 선택' }).waitFor();
  await assertNoRawVisibleText(page, 'consultations detail dialog');
  await page.screenshot({ path: '/Users/etlab/paca-consultations-trial-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobile(browser) {
  const result = await createConsultationsPage(browser, { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/consultations', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 관리' }).waitFor();
  await page.getByTestId('consultations-operations-workspace').waitFor();
  await page.getByTestId('consultations-filter-bar').waitFor();
  const mobileQueue = page.getByTestId('consultations-work-queue');
  await mobileQueue.waitFor();
  await mobileQueue.getByText('확인 필요', { exact: true }).waitFor();
  await page.getByText('김진우').first().waitFor();
  await assertNoRawVisibleText(page, 'consultations mobile');
  await assertNoHorizontalOverflow(page, 'consultations mobile');
  await page.screenshot({ path: '/Users/etlab/paca-consultations-mobile.png', fullPage: true });

  await page.getByText('김진우').first().click();
  await page.getByText('상담 신청 상세').waitFor();
  await page.getByRole('button', { name: '상담 진행' }).waitFor();
  await page.getByRole('button', { name: '체험 등록' }).waitFor();
  await assertNoRawVisibleText(page, 'consultations detail mobile');
  await assertNoHorizontalOverflow(page, 'consultations detail mobile');
  await page.screenshot({ path: '/Users/etlab/paca-consultations-detail-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createConsultationsPage(browser, { width: 390, height: 844 }, 'load-error');
  const { context, page } = result;

  await page.goto('/consultations', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 목록을 불러오지 못했습니다' }).waitFor();
  await page.getByText('잠시 후 다시 시도해주세요.').waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
  await assertNoRawVisibleText(page, 'consultations load error');
  await assertNoHorizontalOverflow(page, 'consultations load error');
  await page.screenshot({ path: '/Users/etlab/paca-consultations-error-mobile.png', fullPage: true });

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
    const loadError = await runLoadError(browser);
    [desktop, mobile, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      errorHits: loadError.state.hits,
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
