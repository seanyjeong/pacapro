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
    paid_amount: '0',
    remaining_amount: '348000',
    payment_status: 'partial',
    payment_method: 'account',
    paid_date: '2026-06-10',
    due_date: '2026-06-05',
    notes: '분납 예정',
    created_at: '2026-06-01T09:00:00.000Z',
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

    if (method === 'GET' && path === '/students/41') {
      return jsonRoute(route, {
        message: 'ok',
        payments: [makePayment()],
        performances: [],
        student: makeStudent(),
      });
    }

    if (method === 'GET' && path === '/students/41/rest-credits') {
      return jsonRoute(route, { credits: [], message: 'ok', pendingTotal: 0 });
    }

    if (method === 'GET' && path === '/students/41/attendance') {
      return jsonRoute(route, {
        records: [],
        student_id: 41,
        summary: { absent: 0, attendance_rate: 0, excused: 0, late: 0, makeup: 0, present: 0, total: 0 },
        year_month: url.searchParams.get('year_month') || '2026-06',
      });
    }

    if (method === 'GET' && path === '/student-consultations/41') {
      return jsonRoute(route, { consultations: [], initialConsultations: [] });
    }

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, { settings: { academy_name: 'PACA 일산' } });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createPage(browser, viewport) {
  const state = { hits: [] };
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, page, state, diagnostics };
}

async function assertWorkspace(page, label) {
  await page.getByTestId('student-detail-workspace').waitFor();
  const board = page.getByTestId('student-detail-operations-board');
  await board.getByRole('heading', { name: '학생 작업 보드' }).waitFor();
  await board.getByText('미납 관리').waitFor();
  await board.getByText('348,000원').waitFor();
  await board.getByRole('button', { name: '수업일 변경' }).waitFor();
  await board.getByRole('button', { name: '문자 발송' }).waitFor();
  await board.getByRole('button', { name: '납부 내역' }).waitFor();
  await board.getByRole('button', { name: '출결 현황' }).waitFor();
  await board.getByRole('button', { name: '상담 기록' }).waitFor();
  await assertNoRawVisibleText(page, label);
  await assertNoHorizontalOverflow(page, label);
}

async function runDesktop(browser) {
  const result = await createPage(browser, { width: 1365, height: 900 });
  const { context, page, state } = result;
  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await assertWorkspace(page, 'student detail workspace desktop');
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '납부 내역' }).click();
  if ((await page.getByRole('link', { name: '2026-06 납부 수정' }).getAttribute('href')) !== '/payments/501/edit') throw new Error('unexpected payment edit link');
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '출결 현황' }).click();
  await page.getByText('출결 기록이 없습니다.').waitFor();
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '상담 기록' }).click();
  await page.getByText('상담 기록이 없습니다').waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-workspace-desktop.png', fullPage: true });
  await context.close();
  return { diagnostics: result.diagnostics, state };
}

async function runMobile(browser) {
  const result = await createPage(browser, { width: 390, height: 844 });
  const { context, page, state } = result;
  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await assertWorkspace(page, 'student detail workspace mobile');
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-workspace-mobile.png', fullPage: true });
  await context.close();
  return { diagnostics: result.diagnostics, state };
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
    [desktop, mobile].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
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
