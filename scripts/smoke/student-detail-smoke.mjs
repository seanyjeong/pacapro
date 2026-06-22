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

function makeStudent() {
  return {
    id: 41,
    academy_id: 1,
    student_number: 'S-2026-041',
    name: '김진우',
    gender: 'male',
    student_type: 'exam',
    phone: '010-1111-2222',
    parent_phone: '010-3333-4444',
    school: '일산고',
    grade: '고2',
    age: null,
    address: '경기 고양시 일산동구',
    admission_type: 'regular',
    profile_image_url: null,
    class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
    weekly_count: 2,
    monthly_tuition: '520000',
    discount_rate: '10',
    discount_reason: '형제 할인',
    payment_due_day: 5,
    final_monthly_tuition: '468000',
    is_season_registered: true,
    current_season_id: 7,
    status: 'active',
    rest_start_date: null,
    rest_end_date: null,
    rest_reason: null,
    enrollment_date: '2026-03-04',
    withdrawal_date: null,
    notes: '정시 준비 집중 관리',
    is_trial: false,
    trial_remaining: null,
    trial_dates: null,
    time_slot: 'evening',
    memo: null,
    class_days_next: null,
    class_days_effective_from: null,
    consultation_date: '2026-02-20',
    academy_name: 'PACA 일산',
    created_at: '2026-02-20T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    deleted_at: null,
  };
}

function makePayment() {
  return {
    id: 501,
    student_id: 41,
    student_name: '김진우',
    year_month: '2026-06',
    base_amount: '520000',
    discount_amount: '52000',
    final_amount: '468000',
    paid_amount: '120000',
    payment_status: 'partial',
    payment_method: 'account',
    paid_date: '2026-06-10',
    due_date: '2026-06-05',
    notes: '분납 예정',
    created_at: '2026-06-01T09:00:00.000Z',
  };
}

function makeState(mode) {
  return {
    hits: [],
    mode,
    payment: makePayment(),
    student: makeStudent(),
  };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'chejump.com' || url.hostname === 'supermax.kr';

    if (!isApi) return route.continue();

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/students/41') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        message: 'ok',
        payments: [state.payment],
        performances: [],
        student: state.student,
      });
    }

    if (method === 'GET' && path === '/students/41/rest-credits') {
      return jsonRoute(route, { credits: [], message: 'ok', pendingTotal: 0 });
    }

    if (method === 'GET' && path === '/students/41/attendance') {
      return jsonRoute(route, {
        records: [
          { attendance_status: 'present', date: '2026-06-03', is_makeup: false, notes: null, time_slot: 'evening' },
          { attendance_status: 'late', date: '2026-06-05', is_makeup: false, notes: '10분 지각', time_slot: 'evening' },
        ],
        student_id: 41,
        summary: { absent: 0, attendance_rate: 50, excused: 0, late: 1, makeup: 0, present: 1, total: 2 },
        year_month: url.searchParams.get('year_month') || '2026-06',
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createStudentDetailPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, page, state, diagnostics };
}

async function runNormalDesktop(browser) {
  const result = await createStudentDetailPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor({ timeout: 15000 });
  await page.getByText('김진우').first().waitFor();
  await page.getByText('S-2026-041').waitFor();
  await assertNoRawVisibleText(page, 'student detail desktop');
  await assertNoHorizontalOverflow(page, 'student detail desktop');
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-desktop.png', fullPage: true });

  await page.getByRole('button', { name: /납부 내역/ }).click();
  await page.getByText('2026-06', { exact: true }).waitFor();
  await page.getByText('468,000원').first().waitFor();

  await context.close();
  return { diagnostics: result.diagnostics, state };
}

async function runNormalMobile(browser) {
  const result = await createStudentDetailPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByText('김진우').first().waitFor();
  await assertNoRawVisibleText(page, 'student detail mobile');
  await assertNoHorizontalOverflow(page, 'student detail mobile');
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runError(browser) {
  const result = await createStudentDetailPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByText('학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor({ timeout: 15000 });
  await assertNoRawVisibleText(page, 'student detail error');
  await assertNoHorizontalOverflow(page, 'student detail error');
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-error-mobile.png', fullPage: true });

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
    const desktop = await runNormalDesktop(browser);
    const mobile = await runNormalMobile(browser);
    const error = await runError(browser);
    [desktop, mobile, error].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      errorConsoleErrors: error.diagnostics.consoleErrors,
      errorHits: error.state.hits,
      mobileHits: mobile.state.hits,
      normalConsoleErrors: desktop.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
