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

const BASE_URL = process.env.PACA_SMOKE_BASE_URL || 'http://localhost:3109';

const season = {
  id: 88,
  academy_id: 1,
  season_name: '2026 정시 집중반',
  season_type: 'regular',
  season_start_date: '2026-07-01',
  season_end_date: '2026-12-10',
  non_season_end_date: '2026-06-30',
  operating_days: [1, 3, 5],
  grade_time_slots: { 고3: ['afternoon', 'evening'], N수: ['morning', 'evening'] },
  default_season_fee: '1500000',
  allows_continuous: true,
  continuous_to_season_type: 'early',
  continuous_discount_type: 'rate',
  continuous_discount_rate: 20,
  status: 'active',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const students = [
  {
    id: 10,
    name: '김민서',
    phone: '010-1111-2222',
    grade: '고3',
    grade_type: 'high',
    student_type: 'regular',
    status: 'active',
    is_trial: false,
    is_season_registered: false,
    current_season_id: null,
  },
  {
    id: 11,
    name: '한서준',
    phone: '010-3333-4444',
    grade: 'N수',
    grade_type: 'n_su',
    student_type: 'regular',
    status: 'active',
    is_trial: false,
    is_season_registered: false,
    current_season_id: null,
  },
  {
    id: 12,
    name: '이등록',
    phone: '010-5555-6666',
    grade: '고3',
    grade_type: 'high',
    student_type: 'regular',
    status: 'active',
    is_trial: false,
    is_season_registered: true,
    current_season_id: 88,
  },
  {
    id: 13,
    name: '저학년',
    phone: '010-7777-8888',
    grade: '고2',
    grade_type: 'middle',
    student_type: 'regular',
    status: 'active',
    is_trial: false,
    is_season_registered: false,
    current_season_id: null,
  },
  {
    id: 14,
    name: '휴원학생',
    phone: '010-9999-0000',
    grade: '고3',
    grade_type: 'high',
    student_type: 'regular',
    status: 'paused',
    is_trial: false,
    is_season_registered: false,
    current_season_id: null,
  },
  {
    id: 15,
    name: '체험학생',
    phone: '010-1212-3434',
    grade: '고3',
    grade_type: 'high',
    student_type: 'regular',
    status: 'trial',
    is_trial: true,
    is_season_registered: false,
    current_season_id: null,
  },
  {
    id: 16,
    name: '퇴원학생',
    phone: '010-5656-7878',
    grade: 'N수',
    grade_type: 'n_su',
    student_type: 'regular',
    status: 'withdrawn',
    is_trial: false,
    is_season_registered: false,
    current_season_id: null,
  },
];

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], enrollPayloads: [], ...overrides };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocal = url.origin === BASE_URL;
    const isApi = url.hostname === 'supermax.kr';

    if (!isApi) {
      if (!isLocal) state.externalContinues.push(request.url());
      return route.continue();
    }

    const method = request.method();
    const path = normalizePacaApiPath(url);
    const pathWithSearch = `${path}${url.search}`;
    state.hits.push(`${method} ${pathWithSearch}`);

    if (state.failLoad && method === 'GET' && path === '/seasons/88') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/seasons/88') {
      return jsonRoute(route, { message: 'ok', season });
    }
    if (state.failStudents && method === 'GET' && path === '/students') {
      return jsonRoute(route, { message: 'HTTP 500 stack trace' }, 500);
    }
    if (
      method === 'GET' &&
      path === '/students' &&
      url.searchParams.get('grade_type') === 'high' &&
      url.searchParams.get('status') === 'active' &&
      url.searchParams.get('is_trial') === 'false'
    ) {
      return jsonRoute(route, { students });
    }
    if (state.failEnroll && method === 'POST' && path === '/seasons/88/enroll') {
      return jsonRoute(route, { message: 'HTTP 500 stack trace' }, 500);
    }
    if (method === 'POST' && path === '/seasons/88/enroll') {
      const payload = request.postDataJSON();
      state.enrollPayloads.push(payload);
      return jsonRoute(route, {
        message: 'registered',
        enrollment: {
          id: 701,
          student_id: payload.student_id,
          season_id: 88,
          season_fee: String(payload.season_fee),
          registration_date: '2026-06-22',
          prorated_month: null,
          prorated_amount: null,
          prorated_details: null,
          is_continuous: false,
          previous_season_id: null,
          discount_type: payload.discount_amount > 0 ? 'custom' : null,
          discount_amount: String(payload.discount_amount ?? 0),
          final_fee: String(payload.season_fee - (payload.discount_amount ?? 0)),
          status: 'registered',
          payment_status: 'pending',
          registered_at: '2026-06-22T09:00:00Z',
          notes: null,
          time_slots: payload.time_slots,
        },
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/88/enroll', { waitUntil: 'networkidle' });
  await page.getByTestId('season-enroll-workspace').waitFor();
  await page.getByRole('heading', { name: '학생 등록' }).waitFor();
  await page.getByText('김민서').waitFor();
  await page.getByText('이등록').waitFor();
  await page.getByText('휴원학생').waitFor({ state: 'hidden' });
  await page.getByText('체험학생').waitFor({ state: 'hidden' });
  await page.getByText('퇴원학생').waitFor({ state: 'hidden' });
  const availableDetailLink = page.getByRole('link', { name: '김민서 학생 상세' }).first();
  await availableDetailLink.waitFor();
  const availableHref = await availableDetailLink.getAttribute('href');
  if (availableHref !== '/students/10') {
    throw new Error(`season enroll available student href mismatch: ${availableHref}`);
  }
  const enrolledDetailLink = page.getByRole('link', { name: '이등록 학생 상세' }).first();
  await enrolledDetailLink.waitFor();
  const enrolledHref = await enrolledDetailLink.getAttribute('href');
  if (enrolledHref !== '/students/12') {
    throw new Error(`season enroll enrolled student href mismatch: ${enrolledHref}`);
  }
  await assertNoRawVisibleText(page, 'season enroll desktop');
  await assertNoHorizontalOverflow(page, 'season enroll desktop');
  await page.screenshot({ path: '/Users/etlab/paca-season-enroll-desktop.png', fullPage: true });

  await page.getByPlaceholder('학생 이름 또는 전화번호').fill('김민서');
  await page.getByText('한서준').waitFor({ state: 'hidden' });
  await page.locator('[data-testid="available-student-row"]:has-text("김민서")').getByRole('button', { name: '시간대 선택' }).click();
  await page.getByRole('dialog', { name: '시간대 선택' }).waitFor();
  await page.getByRole('button', { name: '오전' }).click();
  await page.getByLabel('할인 금액').fill('100000');
  await page.getByRole('button', { name: '등록하기' }).click();
  await page.getByText('시즌 등록이 완료되었습니다.').waitFor();

  const payload = state.enrollPayloads.at(-1);
  if (payload?.student_id !== 10) throw new Error(`unexpected student id ${JSON.stringify(payload)}`);
  if (payload?.season_fee !== 1500000) throw new Error(`unexpected fee ${JSON.stringify(payload)}`);
  if (payload?.discount_amount !== 100000) throw new Error(`unexpected discount ${JSON.stringify(payload)}`);
  for (const slot of ['afternoon', 'evening', 'morning']) {
    if (!payload?.time_slots?.includes(slot)) throw new Error(`missing slot ${slot}: ${JSON.stringify(payload)}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('season-enroll-workspace').waitFor();
  await page
    .getByTestId('available-student-row')
    .first()
    .getByRole('link', { exact: true, name: '김민서 학생 상세' })
    .waitFor();
  await page
    .getByTestId('enrolled-student-row')
    .first()
    .getByRole('link', { exact: true, name: '이등록 학생 상세' })
    .waitFor();
  await assertNoRawVisibleText(page, 'season enroll mobile');
  await assertNoHorizontalOverflow(page, 'season enroll mobile');
  await page.screenshot({ path: '/Users/etlab/paca-season-enroll-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/88/enroll', { waitUntil: 'networkidle' });
  await page.getByText('시즌 등록 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'season enroll load error');
  await assertNoHorizontalOverflow(page, 'season enroll load error');
  await page.screenshot({ path: '/Users/etlab/paca-season-enroll-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runSubmitError(browser) {
  const state = makeState({ failEnroll: true });
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/88/enroll', { waitUntil: 'networkidle' });
  await page.locator('[data-testid="available-student-row"]:has-text("김민서")').getByRole('button', { name: '시간대 선택' }).click();
  await page.getByRole('button', { name: '등록하기' }).click();
  await page.getByText('학생 등록을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'season enroll submit error');
  await assertNoHorizontalOverflow(page, 'season enroll submit error');

  await context.close();
  return { state, diagnostics };
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const normal = await runNormal(browser);
    const loadError = await runLoadError(browser);
    const submitError = await runSubmitError(browser);
    [normal, loadError, submitError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      enrollPayloads: normal.state.enrollPayloads,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
      submitErrorConsoleErrors: submitError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
