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

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const today = formatDate(new Date());
const instructor = { id: 3, name: '박코치', salary_type: 'hourly' };

const schedules = [{
  id: 101,
  class_date: today,
  time_slot: 'afternoon',
  instructor_id: 3,
  instructor_name: '박코치',
  title: '오후 실기 집중반',
  content: '기록 점검',
  attendance_taken: false,
  student_count: 8,
  trial_count: 0,
  created_at: '2026-06-01T09:00:00Z',
  updated_at: '2026-06-01T09:00:00Z',
}];

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], instructorAttendancePayload: null, ...overrides };
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
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/schedules') return jsonRoute(route, { schedules });
    if (method === 'GET' && path === '/schedules/instructor-schedules/month') {
      return jsonRoute(route, {
        message: 'ok',
        schedules: {
          [today]: {
            afternoon: { scheduled: 1, attended: 0 },
            evening: { scheduled: 0, attended: 0 },
            morning: { scheduled: 0, attended: 0 },
          },
        },
        year_month: `${url.searchParams.get('year')}-${url.searchParams.get('month')}`,
      });
    }
    if (method === 'GET' && path === '/consultations/calendar/events') return jsonRoute(route, { events: {} });
    if (method === 'GET' && path === '/instructors/overtime/pending') return jsonRoute(route, { requests: [] });
    if (method === 'GET' && path === `/schedules/date/${today}/instructor-attendance`) {
      if (state.failLoad) return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      return jsonRoute(route, {
        attendances: [],
        date: today,
        instructors: [instructor],
        instructors_by_slot: { afternoon: [instructor], evening: [], morning: [] },
      });
    }
    if (method === 'POST' && path === `/schedules/date/${today}/instructor-attendance`) {
      state.instructorAttendancePayload = request.postDataJSON();
      if (state.failSave) return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      return jsonRoute(route, { message: 'saved' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createPage(browser, stateOverrides = {}) {
  const state = makeState(stateOverrides);
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { context, diagnostics: createDiagnostics(page), page, state };
}

async function openInstructorAttendance(page) {
  await page.goto('/schedules', { waitUntil: 'networkidle' });
  await page.getByTestId('schedules-workspace').waitFor();
  await page.getByText(/\d{4}년\s+\d{1,2}월/).first().waitFor();
  await page.getByRole('button', { name: '강사 출근' }).first().click();
}

async function runLoadError(browser) {
  const result = await createPage(browser, { failLoad: true });
  const { context, page } = result;
  await openInstructorAttendance(page);
  await page.getByText('강사 출근 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'instructor attendance load error');
  await assertNoHorizontalOverflow(page, 'instructor attendance load error');
  await page.screenshot({ path: '/Users/etlab/paca-instructor-attendance-load-error.png', fullPage: true });
  await context.close();
  return result;
}

async function runSaveSuccess(browser) {
  const result = await createPage(browser);
  const { context, page, state } = result;
  await openInstructorAttendance(page);
  await page.getByText('강사 출근 현황').waitFor();
  await page.getByRole('button', { name: '전체 출근' }).click();

  const saveResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().includes(`/schedules/date/${today}/instructor-attendance`)
  ));
  await page.getByRole('button', { name: '저장' }).click();
  await saveResponse;

  await page.getByText('박코치').waitFor();
  await assertNoRawVisibleText(page, 'instructor attendance save success');
  await assertNoHorizontalOverflow(page, 'instructor attendance save success');

  const submitted = state.instructorAttendancePayload?.attendances?.[0];
  if (submitted?.instructor_id !== 3 || submitted?.time_slot !== 'afternoon' || submitted?.attendance_status !== 'present') {
    throw new Error(`unexpected instructor attendance success payload: ${JSON.stringify(state.instructorAttendancePayload)}`);
  }
  await context.close();
  return result;
}

async function runSaveError(browser) {
  const result = await createPage(browser, { failSave: true });
  const { context, page, state } = result;
  await openInstructorAttendance(page);
  await page.getByText('강사 출근 현황').waitFor();
  await page.getByRole('button', { name: '전체 출근' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByText('강사 출근 정보를 저장하지 못했습니다. 선택 내용을 확인한 뒤 다시 시도해주세요.').waitFor();
  await page.getByText('박코치').waitFor();
  await assertNoRawVisibleText(page, 'instructor attendance save error');
  await assertNoHorizontalOverflow(page, 'instructor attendance save error');
  await page.screenshot({ path: '/Users/etlab/paca-instructor-attendance-save-error.png', fullPage: true });

  const submitted = state.instructorAttendancePayload?.attendances?.[0];
  if (submitted?.instructor_id !== 3 || submitted?.time_slot !== 'afternoon' || submitted?.attendance_status !== 'present') {
    throw new Error(`unexpected instructor attendance payload: ${JSON.stringify(state.instructorAttendancePayload)}`);
  }
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
    const saveSuccess = await runSaveSuccess(browser);
    const loadError = await runLoadError(browser);
    const saveError = await runSaveError(browser);
    [saveSuccess, loadError, saveError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      successPayload: saveSuccess.state.instructorAttendancePayload,
      hits: saveError.state.hits,
      instructorAttendancePayload: saveError.state.instructorAttendancePayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
