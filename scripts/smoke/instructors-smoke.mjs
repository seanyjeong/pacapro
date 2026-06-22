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

function makeInstructor(overrides = {}) {
  return {
    id: 31,
    academy_id: 1,
    user_id: null,
    name: '최강사',
    phone: '010-1111-2222',
    gender: 'female',
    email: 'coach@example.com',
    address: '경기도 고양시',
    birth_date: null,
    resident_number: null,
    hire_date: '2025-03-04',
    salary_type: 'hourly',
    instructor_type: 'teacher',
    base_salary: '0',
    hourly_rate: '45000',
    morning_class_rate: '0',
    afternoon_class_rate: '0',
    evening_class_rate: '0',
    incentive_rate: '0',
    tax_type: '3.3%',
    bank_name: '국민은행',
    account_number: '123-456-7890',
    account_holder: '최강사',
    status: 'active',
    notes: '수업 리드',
    work_days: null,
    work_start_time: null,
    work_end_time: null,
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function makeAttendance(overrides = {}) {
  return {
    id: 701,
    instructor_id: 31,
    work_date: '2026-06-22',
    time_slot: 'evening',
    check_in_time: '18:00:00',
    check_out_time: '21:00:00',
    attendance_status: 'present',
    notes: '정상 출근',
    created_at: '2026-06-22T09:00:00.000Z',
    ...overrides,
  };
}

function makeSalary(overrides = {}) {
  return {
    id: 801,
    instructor_id: 31,
    academy_id: 1,
    instructor_name: '최강사',
    year_month: '2026-06',
    base_amount: '720000',
    incentive_amount: '0',
    total_deduction: '23760',
    tax_amount: '23760',
    net_salary: '696240',
    total_hours: 16,
    payment_status: 'pending',
    payment_date: null,
    notes: null,
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    ...overrides,
  };
}

const INSTRUCTORS = [
  makeInstructor({ id: 31, name: '최강사', status: 'active' }),
  makeInstructor({ id: 32, name: '박코치', gender: 'male', phone: '010-3333-4444', salary_type: 'monthly', base_salary: '2600000' }),
  makeInstructor({ id: 33, name: '이휴직', status: 'on_leave', salary_type: 'per_class', hourly_rate: '70000' }),
];

function makeState(mode) {
  return { createPayload: null, editPayload: null, hits: [], mode };
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

    if (method === 'GET' && path === '/instructors') {
      if (state.mode === 'list-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'ok', instructors: INSTRUCTORS });
    }

    if (method === 'GET' && path === '/instructors/31') {
      if (state.mode === 'detail-error' || state.mode === 'edit-load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        message: 'ok',
        instructor: makeInstructor({ id: 31, name: '최강사' }),
        attendances: [makeAttendance()],
        salaries: [makeSalary()],
      });
    }

    if (method === 'POST' && path === '/instructors') {
      state.createPayload = JSON.parse(request.postData() || '{}');
      if (state.mode === 'create-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'created', instructor: makeInstructor({ name: state.createPayload.name }) });
    }

    if (method === 'PUT' && path === '/instructors/31') {
      state.editPayload = JSON.parse(request.postData() || '{}');
      if (state.mode === 'edit-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'updated', instructor: makeInstructor({ id: 31, name: state.editPayload.name }) });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createInstructorPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function fillInstructorFields(page, name = '김신규') {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.locator('#instructor-name').fill(name);
  await page.locator('#instructor-phone').fill('010-2222-3333');
  await page.locator('#instructor-hourly-rate').fill('45000');
}

async function runListDesktop(browser) {
  const result = await createInstructorPage(browser, 'success');
  const { context, page } = result;

  await page.goto('/instructors', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '강사 운영' }).waitFor();
  await page.locator('table').getByText('최강사').waitFor();
  await page.locator('table').getByText('박코치').waitFor();
  await page.locator('table').getByRole('button', { name: '최강사 상세 보기' }).waitFor();
  await assertNoRawVisibleText(page, 'instructors list desktop');
  await assertNoHorizontalOverflow(page, 'instructors list desktop');
  await page.screenshot({ path: '/Users/etlab/paca-instructors-desktop.png', fullPage: true });

  await page.getByPlaceholder('이름, 전화번호, 이메일로 검색...').fill('박코치');
  await page.locator('table').getByText('박코치').waitFor();

  await context.close();
  return result;
}

async function runListError(browser) {
  const result = await createInstructorPage(browser, 'list-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/instructors', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '강사 정보를 불러오지 못했습니다' }).waitFor();
  await assertNoRawVisibleText(page, 'instructors list error');
  await assertNoHorizontalOverflow(page, 'instructors list error');
  await page.screenshot({ path: '/Users/etlab/paca-instructors-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runDetailDesktop(browser) {
  const result = await createInstructorPage(browser, 'success');
  const { context, page } = result;

  await page.goto('/instructors/31', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '강사 상세' }).waitFor();
  await page.getByText('최강사').first().waitFor();
  await page.getByRole('heading', { name: '출퇴근 기록' }).waitFor();
  await page.getByRole('heading', { name: '급여 기록' }).waitFor();
  await assertNoRawVisibleText(page, 'instructors detail desktop');
  await assertNoHorizontalOverflow(page, 'instructors detail desktop');
  await page.screenshot({ path: '/Users/etlab/paca-instructor-detail-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runDetailError(browser) {
  const result = await createInstructorPage(browser, 'detail-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/instructors/31', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '강사 정보를 불러오지 못했습니다' }).waitFor();
  await assertNoRawVisibleText(page, 'instructors detail error');
  await assertNoHorizontalOverflow(page, 'instructors detail error');
  await page.screenshot({ path: '/Users/etlab/paca-instructor-detail-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runCreateError(browser) {
  const result = await createInstructorPage(browser, 'create-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/instructors/new', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '강사 등록' }).waitFor();
  await fillInstructorFields(page);
  await page.locator('form button[type="submit"]').click();
  await page.locator('form').getByText('저장 실패').waitFor();
  await page.locator('form').getByText('강사 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'instructors create error');
  await assertNoHorizontalOverflow(page, 'instructors create error');
  await page.screenshot({ path: '/Users/etlab/paca-instructor-create-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runEditLoadError(browser) {
  const result = await createInstructorPage(browser, 'edit-load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/instructors/31/edit', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '강사 수정' }).waitFor();
  await page.getByRole('heading', { name: '강사 정보를 불러오지 못했습니다' }).waitFor();
  await assertNoRawVisibleText(page, 'instructors edit load error');
  await assertNoHorizontalOverflow(page, 'instructors edit load error');
  await page.screenshot({ path: '/Users/etlab/paca-instructor-edit-load-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runEditError(browser) {
  const result = await createInstructorPage(browser, 'edit-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/instructors/31/edit', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '강사 수정' }).waitFor();
  await page.locator('#instructor-name').fill('최강사수정');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.locator('form button[type="submit"]').click();
  await page.locator('form').getByText('저장 실패').waitFor();
  await page.locator('form').getByText('강사 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'instructors edit error');
  await assertNoHorizontalOverflow(page, 'instructors edit error');
  await page.screenshot({ path: '/Users/etlab/paca-instructor-edit-error-mobile.png', fullPage: true });

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
    const listDesktop = await runListDesktop(browser);
    const listError = await runListError(browser);
    const detailDesktop = await runDetailDesktop(browser);
    const detailError = await runDetailError(browser);
    const createError = await runCreateError(browser);
    const editLoadError = await runEditLoadError(browser);
    const editError = await runEditError(browser);
    [listDesktop, listError, detailDesktop, detailError, createError, editLoadError, editError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      createPayload: createError.state.createPayload,
      detailHits: detailDesktop.state.hits,
      editPayload: editError.state.editPayload,
      editLoadErrorHits: editLoadError.state.hits,
      listHits: listDesktop.state.hits,
      listErrorHits: listError.state.hits,
      normalConsoleErrors: listDesktop.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
