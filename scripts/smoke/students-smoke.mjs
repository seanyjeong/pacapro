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

function makeStudent(overrides) {
  return {
    id: 1,
    academy_id: 1,
    student_number: '2026041',
    name: '김진우',
    gender: 'male',
    student_type: 'exam',
    phone: '01011112222',
    parent_phone: '01033334444',
    school: '일산고',
    grade: '고2',
    age: null,
    address: null,
    admission_type: 'regular',
    profile_image_url: null,
    class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
    weekly_count: 2,
    monthly_tuition: '520000',
    discount_rate: '10',
    discount_reason: null,
    payment_due_day: 5,
    final_monthly_tuition: '468000',
    is_season_registered: false,
    current_season_id: null,
    status: 'active',
    rest_start_date: null,
    rest_end_date: null,
    rest_reason: null,
    enrollment_date: '2026-03-04',
    withdrawal_date: null,
    notes: null,
    is_trial: false,
    trial_remaining: null,
    trial_dates: null,
    time_slot: 'evening',
    memo: null,
    class_days_next: null,
    class_days_effective_from: null,
    consultation_date: '2026-02-20',
    created_at: '2026-02-20T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

const STUDENTS = [
  makeStudent({ id: 41, name: '김진우', school: '일산고', status: 'active' }),
  makeStudent({ id: 42, name: '박서연', gender: 'female', school: '강남고', status: 'active', student_number: '2026042' }),
  makeStudent({ id: 43, name: '이민수', school: '상담대기고', status: 'pending', student_number: '2026043' }),
  makeStudent({ id: 44, name: '최체험', gender: 'female', school: '체험고', status: 'trial', is_trial: true, trial_remaining: 1 }),
  makeStudent({ id: 45, name: '한휴원', school: '휴원고', status: 'paused', rest_start_date: '2026-06-01' }),
];

function makeState(mode) {
  return { hits: [], mode };
}

function filterStudents(url) {
  const status = url.searchParams.get('status');
  const isTrial = url.searchParams.get('is_trial');
  const search = url.searchParams.get('search')?.trim();

  let students = [...STUDENTS];
  if (isTrial === 'true') students = students.filter((student) => student.is_trial);
  if (isTrial === 'false') students = students.filter((student) => !student.is_trial);
  if (status) students = students.filter((student) => student.status === status);
  if (search) {
    students = students.filter((student) =>
      [student.name, student.phone, student.student_number, student.school].some((value) => value?.includes(search)),
    );
  }

  return students;
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

    if (method === 'GET' && path === '/students') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }

      const students = filterStudents(url);
      return jsonRoute(route, {
        message: 'ok',
        pagination: { total: students.length, page: 1, limit: 100, totalPages: 1 },
        students,
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createStudentsPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, page, state, diagnostics };
}

async function runDesktop(browser) {
  const result = await createStudentsPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 운영' }).waitFor();
  await page.locator('table').getByText('김진우').waitFor();
  await page.locator('table').getByText('박서연').waitFor();
  await assertNoRawVisibleText(page, 'students desktop');
  await assertNoHorizontalOverflow(page, 'students desktop');
  await page.screenshot({ path: '/Users/etlab/paca-students-desktop.png', fullPage: true });

  await page.getByRole('button', { name: /미등록관리/ }).click();
  await page.locator('table').getByText('이민수').waitFor();
  await page.getByPlaceholder('이름, 학번, 전화번호로 검색...').fill('이민수');
  await page.locator('table').getByText('이민수').waitFor();

  await context.close();
  return { diagnostics: result.diagnostics, state };
}

async function runMobile(browser) {
  const result = await createStudentsPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 운영' }).waitFor();
  await page.locator('button').filter({ hasText: '김진우' }).first().waitFor();
  await assertNoRawVisibleText(page, 'students mobile');
  await assertNoHorizontalOverflow(page, 'students mobile');
  await page.screenshot({ path: '/Users/etlab/paca-students-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createStudentsPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByText('학생 정보를 불러오지 못했습니다').waitFor();
  await page.getByRole('button', { name: '학생 등록' }).waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
  await assertNoRawVisibleText(page, 'students load error');
  await assertNoHorizontalOverflow(page, 'students load error');
  await page.screenshot({ path: '/Users/etlab/paca-students-error-mobile.png', fullPage: true });

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
      errorConsoleErrors: loadError.diagnostics.consoleErrors,
      errorHits: loadError.state.hits,
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
