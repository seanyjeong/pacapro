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

function makeStudent(overrides = {}) {
  return {
    id: 41,
    name: '김진우',
    gender: 'male',
    student_type: 'exam',
    phone: '010-1111-2222',
    parent_phone: '010-3333-4444',
    school: '일산고',
    grade: '고2',
    admission_type: 'regular',
    class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
    weekly_count: 2,
    monthly_tuition: '520000',
    final_monthly_tuition: '468000',
    discount_rate: '10',
    status: 'active',
    is_trial: false,
    trial_remaining: 0,
    enrollment_date: '2026-03-04',
    memo: '정시 준비 집중 관리',
    address: '경기 고양시 일산동구',
    ...overrides,
  };
}

const STUDENTS = [
  makeStudent(),
  makeStudent({ id: 42, name: '박서연', gender: 'female', phone: '010-2222-3333', school: '강남고' }),
];

function makeState(mode = 'success') {
  return { hits: [], mode };
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
      if (state.mode === 'list-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        message: 'ok',
        pagination: { total: STUDENTS.length, page: 1, limit: 100, totalPages: 1 },
        students: STUDENTS,
      });
    }

    if (method === 'GET' && path === '/students/41') {
      if (state.mode === 'detail-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'ok', student: makeStudent() });
    }

    if (method === 'GET' && path === '/schedules') {
      return jsonRoute(route, {
        schedules: [
          {
            id: 701,
            attendances: [
              { student_id: 41, attendance_status: 'present' },
              { student_id: 41, attendance_status: 'late' },
              { student_id: 42, attendance_status: 'absent' },
            ],
          },
        ],
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createTabletStudentsPage(browser, mode, viewport) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function runList(browser, viewport, label) {
  const result = await createTabletStudentsPage(browser, 'success', viewport);
  const { context, page } = result;

  await page.goto('/tablet/students', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 관리' }).waitFor();
  await page.getByRole('navigation', { name: '학생 상태' }).waitFor();
  const jinwooCard = page.getByTestId('tablet-student-card').filter({ hasText: '김진우' });
  await jinwooCard.waitFor();
  await jinwooCard.getByText('일산고').waitFor();
  await jinwooCard.getByRole('link', { name: '김진우 상세 보기' }).waitFor();
  await jinwooCard.getByRole('link', { name: '김진우 문자 보내기' }).waitFor();
  await jinwooCard.getByRole('link', { name: '김진우 결제 확인' }).waitFor();
  await assertNoRawVisibleText(page, `tablet students ${label}`);
  await assertNoHorizontalOverflow(page, `tablet students ${label}`);
  await page.screenshot({ path: `/Users/etlab/paca-tablet-students-${label}.png`, fullPage: true });

  await context.close();
  return result;
}

async function runDetail(browser) {
  const result = await createTabletStudentsPage(browser, 'success', { width: 1180, height: 820 });
  const { context, page } = result;

  await page.goto('/tablet/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '김진우' }).waitFor();
  const actions = page.getByRole('navigation', { name: '학생 업무 바로가기' });
  await actions.waitFor();
  await actions.getByRole('link', { name: '김진우 결제 확인' }).waitFor();
  await actions.getByRole('link', { name: '김진우 문자 보내기' }).waitFor();
  await actions.getByRole('link', { name: '김진우 출석 체크' }).waitFor();
  const classDaysHref = await actions.getByRole('link', { name: '김진우 수업일관리' }).getAttribute('href');
  if (classDaysHref !== '/students/class-days') throw new Error(`class days href mismatch: ${classDaysHref}`);
  const pcDetailHref = await actions.getByRole('link', { name: '김진우 PC 상세 열기' }).getAttribute('href');
  if (pcDetailHref !== '/students/41') throw new Error(`PC detail href mismatch: ${pcDetailHref}`);
  await page.getByText('010-3333-4444').waitFor();
  await page.getByText('468,000원').waitFor();
  await page.getByRole('heading', { name: '이번달 출석' }).waitFor();
  await assertNoRawVisibleText(page, 'tablet student detail');
  await assertNoHorizontalOverflow(page, 'tablet student detail');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-student-detail.png', fullPage: true });

  await context.close();
  return result;
}

async function runDetailError(browser) {
  const result = await createTabletStudentsPage(browser, 'detail-error', { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByText('잠시 후 다시 시도해주세요.').waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
  await assertNoRawVisibleText(page, 'tablet student detail error');
  await assertNoHorizontalOverflow(page, 'tablet student detail error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-student-detail-error.png', fullPage: true });

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
    const landscapeList = await runList(browser, { width: 1180, height: 820 }, 'landscape');
    const portraitList = await runList(browser, { width: 820, height: 1180 }, 'portrait');
    const detail = await runDetail(browser);
    const detailError = await runDetailError(browser);
    [landscapeList, portraitList, detail, detailError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      detailErrorHits: detailError.state.hits,
      detailHits: detail.state.hits,
      landscapeHits: landscapeList.state.hits,
      portraitHits: portraitList.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
