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

function monthRange(date = new Date()) {
  return {
    end: formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    month: date.getMonth(),
    start: formatDate(new Date(date.getFullYear(), date.getMonth(), 1)),
    today: formatDate(date),
    year: date.getFullYear(),
  };
}

const range = monthRange();

const schedules = [
  {
    id: 101,
    class_date: range.today,
    time_slot: 'afternoon',
    instructor_id: 3,
    instructor_name: '박코치',
    title: '오후 실기 집중반',
    content: '기초 체력 및 기록 점검',
    attendance_taken: false,
    notes: '실내',
    student_count: 8,
    trial_count: 1,
    created_at: '2026-06-01T09:00:00Z',
    updated_at: '2026-06-01T09:00:00Z',
  },
];

function makeState(overrides = {}) {
  return {
    createPayload: null,
    deletedScheduleId: null,
    editPayload: null,
    externalContinues: [],
    hits: [],
    ...overrides,
  };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocal = url.origin === BASE_URL;
    const isApi = url.hostname === 'chejump.com' || url.hostname === 'supermax.kr';

    if (!isApi) {
      if (!isLocal) state.externalContinues.push(request.url());
      return route.continue();
    }

    const method = request.method();
    const path = normalizePacaApiPath(url);
    const pathWithSearch = `${path}${url.search}`;
    state.hits.push(`${method} ${pathWithSearch}`);

    if (state.failSchedules && method === 'GET' && path === '/schedules') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'GET' && path === '/schedules') {
      return jsonRoute(route, { schedules });
    }
    if (method === 'GET' && path === '/schedules/101') {
      if (state.failScheduleDetail) {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, { schedule: schedules[0] });
    }
    if (method === 'POST' && path === '/schedules') {
      state.createPayload = JSON.parse(request.postData() || '{}');
      if (state.failScheduleSave) {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, { ...schedules[0], id: 102, ...state.createPayload });
    }
    if (method === 'PUT' && path === '/schedules/101') {
      state.editPayload = JSON.parse(request.postData() || '{}');
      if (state.failScheduleEdit) {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, { ...schedules[0], ...state.editPayload });
    }
    if (method === 'DELETE' && path === '/schedules/101') {
      state.deletedScheduleId = 101;
      return jsonRoute(route, { message: 'deleted' });
    }
    if (method === 'GET' && path === '/schedules/101/attendance') {
      if (state.failAttendanceLoad) {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, {
        schedule: schedules[0],
        students: [
          {
            student_id: 41,
            student_name: '김진우',
            student_number: '2026041',
            attendance_status: null,
            makeup_date: null,
            notes: null,
          },
        ],
      });
    }
    if (method === 'GET' && path === '/schedules/slot') {
      return jsonRoute(route, {
        schedule: {
          ...schedules[0],
          students: [
            {
              student_id: 41,
              student_name: '김진우',
              grade: '고2',
              attendance_status: null,
              is_trial: false,
              is_makeup: false,
              notes: null,
            },
          ],
        },
        available_students: [],
      });
    }
    if (method === 'GET' && path === `/schedules/date/${range.today}/instructor-attendance`) {
      const instructor = { id: 3, name: '박코치', salary_type: 'hourly' };
      return jsonRoute(route, {
        instructors: [instructor],
        instructors_by_slot: { afternoon: [instructor] },
        attendances: [],
      });
    }
    if (method === 'GET' && path === '/instructors') {
      return jsonRoute(route, {
        message: 'ok',
        instructors: [
          { id: 3, name: '박코치', salary_type: 'hourly', status: 'active' },
          { id: 4, name: '최강사', salary_type: 'per_class', status: 'active' },
        ],
      });
    }
    if (method === 'POST' && path === '/instructors/3/overtime') {
      state.extraDayPayload = request.postDataJSON();
      if (state.failExtraDayRequest) return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      return jsonRoute(route, { message: 'created', overtime: { id: 77 } });
    }
    if (method === 'GET' && path === '/schedules/instructor-schedules/month') {
      return jsonRoute(route, {
        message: 'ok',
        year_month: `${url.searchParams.get('year')}-${url.searchParams.get('month')}`,
        schedules: {
          [range.today]: {
            morning: { scheduled: 1, attended: 1 },
            afternoon: { scheduled: 2, attended: 1 },
            evening: { scheduled: 1, attended: 0 },
          },
        },
      });
    }
    if (method === 'GET' && path === '/consultations/calendar/events') {
      return jsonRoute(route, { events: { [range.today]: [{ id: 1, student_name: '상담학생' }] } });
    }
    if (method === 'GET' && path === '/instructors/overtime/pending') {
      return jsonRoute(route, { requests: [{ id: 7 }] });
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

  await page.goto('/schedules', { waitUntil: 'networkidle' });
  await page.getByTestId('schedules-workspace').waitFor();
  await page.getByRole('heading', { name: '수업 관리' }).waitFor();
  await page.getByText(/\d{4}년\s+\d{1,2}월/).first().waitFor();
  await page.getByText('승인 대기').waitFor();
  await page.getByTestId('selected-date-operations').waitFor();
  await page.getByText('선택일 운영').waitFor();
  await page.getByText('오후 실기 집중반').waitFor();
  const attendanceHref = await page
    .getByRole('link', { name: '오후 실기 집중반 출석 체크' })
    .getAttribute('href');
  if (attendanceHref !== '/schedules/101/attendance') {
    throw new Error(`schedule attendance href mismatch: ${attendanceHref}`);
  }
  await assertNoRawVisibleText(page, 'schedules desktop');
  await assertNoHorizontalOverflow(page, 'schedules desktop');
  await page.screenshot({ path: '/Users/etlab/paca-schedules-desktop.png', fullPage: true });

  await page.locator('[aria-label="오후"]').filter({ hasText: '8' }).click();
  await page.getByText('김진우').waitFor();
  const studentDetailHref = await page.getByRole('link', { name: '학생 상세' }).getAttribute('href');
  if (studentDetailHref !== '/students/41') {
    throw new Error(`student detail href mismatch: ${studentDetailHref}`);
  }
  await assertNoRawVisibleText(page, 'schedules slot detail');
  await assertNoHorizontalOverflow(page, 'schedules slot detail');
  await page.screenshot({ path: '/Users/etlab/paca-schedules-slot-detail.png', fullPage: true });
  await page.getByRole('button', { name: '닫기' }).click();

  await page.getByRole('button', { name: '목록' }).click();
  await page.getByTestId('schedule-list-table').waitFor();
  await page.getByTestId('schedule-list-table').getByText('오후 실기 집중반').waitFor();
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '삭제' }), 'schedule list delete');
  const listDeleteDialog = page.getByRole('alertdialog');
  await listDeleteDialog.getByRole('heading', { name: '수업 삭제' }).waitFor();
  await listDeleteDialog.getByText('오후 실기 집중반').waitFor();
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'DELETE' && normalizePacaApiPath(url) === '/schedules/101';
    }),
    listDeleteDialog.getByRole('button', { name: '삭제' }).click(),
  ]);
  await page.getByText('수업이 삭제되었습니다.').waitFor();
  if (state.deletedScheduleId !== 101) throw new Error('schedule delete endpoint not called');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('schedules-workspace').waitFor();
  await page.getByTestId('selected-date-operations').waitFor();
  await assertNoRawVisibleText(page, 'schedules mobile');
  await assertNoHorizontalOverflow(page, 'schedules mobile');
  await page.screenshot({ path: '/Users/etlab/paca-schedules-mobile.png', fullPage: true });

  await page.getByRole('button', { name: '목록' }).click();
  await page.getByTestId('schedule-list-mobile').waitFor();
  await page.getByRole('button', { name: '캘린더' }).click();

  await page.locator('[aria-label="오후"]').filter({ hasText: '8' }).click();
  await page.getByRole('link', { name: '학생 상세' }).waitFor();
  await assertNoRawVisibleText(page, 'schedules slot detail mobile');
  await assertNoHorizontalOverflow(page, 'schedules slot detail mobile');
  await page.screenshot({ path: '/Users/etlab/paca-schedules-slot-detail-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '닫기' }).click();

  if (!state.hits.some((hit) => hit.includes(`/schedules?start_date=${range.start}&end_date=${range.end}`))) {
    throw new Error(`missing schedules month request: ${state.hits.join(' | ')}`);
  }
  if (!state.hits.some((hit) => hit.includes('/schedules/instructor-schedules/month'))) {
    throw new Error('missing monthly instructor stats request');
  }
  if (!state.hits.some((hit) => hit.includes('/consultations/calendar/events'))) {
    throw new Error('missing consultation calendar request');
  }

  await context.close();
  return { state, diagnostics };
}

async function runAttendanceNormal(browser) {
  const result = await createPage(browser, {}, { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/schedules/101/attendance', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: '출석 체크' }).waitFor();
  await page.getByText('학생 출석 체크').waitFor();
  const studentHref = await page
    .getByRole('link', { name: '김진우 학생 상세' })
    .getAttribute('href');
  if (studentHref !== '/students/41') {
    throw new Error(`attendance student href mismatch: ${studentHref}`);
  }
  await assertNoRawVisibleText(page, 'schedule attendance normal mobile');
  await assertNoHorizontalOverflow(page, 'schedule attendance normal mobile');
  await page.screenshot({ path: '/Users/etlab/paca-schedule-attendance-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const state = makeState({ failSchedules: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/schedules', { waitUntil: 'networkidle' });
  await page.getByText('수업 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'schedules load error');
  await assertNoHorizontalOverflow(page, 'schedules load error');
  await page.screenshot({ path: '/Users/etlab/paca-schedules-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function createPage(browser, stateOverrides = {}, viewport = { width: 390, height: 844 }) {
  const state = makeState(stateOverrides);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function clickWithoutNativeDialog(page, locator, label) {
  const nativeDialog = page
    .waitForEvent('dialog', { timeout: 800 })
    .then(async (dialog) => {
      const message = dialog.message();
      await dialog.dismiss();
      return message;
    })
    .catch(() => null);

  await locator.click();
  const message = await nativeDialog;
  if (message) throw new Error(`${label} opened native browser dialog: ${message}`);
}

async function chooseSelectOption(page, triggerSelector, optionName) {
  await page.locator(triggerSelector).click();
  await page.getByText(optionName, { exact: true }).last().click();
}

async function fillScheduleForm(page, title = '오후 실기 집중반') {
  await page.locator('#class_date').fill(range.today);
  await page.getByRole('button', { name: '오후', exact: true }).click();
  await chooseSelectOption(page, '#instructor', '박코치');
  await page.locator('#title').fill(title);
  await page.locator('#content').fill('기록 점검');
}

async function runDetailLoadError(browser) {
  const result = await createPage(browser, { failScheduleDetail: true });
  const { context, page } = result;

  await page.goto('/schedules/101', { waitUntil: 'networkidle' });
  await page.getByText('수업 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'schedule detail load error');
  await assertNoHorizontalOverflow(page, 'schedule detail load error');
  await page.screenshot({ path: '/Users/etlab/paca-schedule-detail-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runDetailDelete(browser) {
  const result = await createPage(browser, {}, { width: 1365, height: 900 });
  const { context, page, state } = result;

  await page.goto('/schedules/101', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: '수업 상세' }).waitFor();
  await page.getByText('오후 실기 집중반').waitFor();
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '삭제' }), 'schedule detail delete');
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('heading', { name: '수업 삭제' }).waitFor();
  await dialog.getByText('오후 실기 집중반').waitFor();
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'DELETE' && normalizePacaApiPath(url) === '/schedules/101';
    }),
    dialog.getByRole('button', { name: '삭제' }).click(),
  ]);
  await page.waitForURL('**/schedules');
  if (state.deletedScheduleId !== 101) throw new Error('schedule detail delete endpoint not called');
  await assertNoRawVisibleText(page, 'schedule detail delete');
  await assertNoHorizontalOverflow(page, 'schedule detail delete');
  await page.screenshot({ path: '/Users/etlab/paca-schedule-detail-delete.png', fullPage: true });

  await context.close();
  return result;
}

async function runCreateSaveError(browser) {
  const result = await createPage(browser, { failScheduleSave: true });
  const { context, page } = result;

  await page.goto('/schedules/new', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: '수업 등록' }).waitFor();
  await fillScheduleForm(page, '신규 등록 실패 테스트');
  await page.locator('form button[type="submit"]').click();
  await page.locator('form').getByText('저장 실패').waitFor();
  await page.locator('form').getByText('수업 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'schedule create save error');
  await assertNoHorizontalOverflow(page, 'schedule create save error');
  await page.screenshot({ path: '/Users/etlab/paca-schedule-create-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runEditSaveError(browser) {
  const result = await createPage(browser, { failScheduleEdit: true });
  const { context, page } = result;

  await page.goto('/schedules/101/edit', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: '수업 수정' }).waitFor();
  await page.locator('#title').fill('수정 실패 테스트');
  await page.locator('form button[type="submit"]').click();
  await page.locator('form').getByText('저장 실패').waitFor();
  await page.locator('form').getByText('수업 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'schedule edit save error');
  await assertNoHorizontalOverflow(page, 'schedule edit save error');
  await page.screenshot({ path: '/Users/etlab/paca-schedule-edit-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runAttendanceLoadError(browser) {
  const result = await createPage(browser, { failAttendanceLoad: true });
  const { context, page } = result;

  await page.goto('/schedules/101/attendance', { waitUntil: 'networkidle' });
  await page.getByText('출석 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'schedule attendance load error');
  await assertNoHorizontalOverflow(page, 'schedule attendance load error');
  await page.screenshot({ path: '/Users/etlab/paca-schedule-attendance-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runExtraDayRequestError(browser) {
  const result = await createPage(browser, { failExtraDayRequest: true }, { width: 1365, height: 900 });
  const { context, page, state } = result;
  await page.goto('/schedules', { waitUntil: 'networkidle' });
  await page.getByTestId('schedules-workspace').waitFor();
  await page.locator('button[title="강사 근무 배정 펼치기"]').click();
  await page.getByRole('button', { name: '미배정 출근' }).click();
  await page.getByRole('heading', { name: '미배정 출근 요청' }).waitFor();
  await page.getByRole('combobox').selectOption('3');
  await page.getByRole('button', { name: '요청하기' }).click();
  await page.getByText('출근 요청을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'extra day request error');
  await assertNoHorizontalOverflow(page, 'extra day request error');
  await page.screenshot({ path: '/Users/etlab/paca-extra-day-request-error.png', fullPage: true });
  if (state.extraDayPayload?.work_date !== range.today) throw new Error(`unexpected extra day payload: ${JSON.stringify(state.extraDayPayload)}`);
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
    const normal = await runNormal(browser);
    const loadError = await runLoadError(browser);
    const detailLoadError = await runDetailLoadError(browser);
    const detailDelete = await runDetailDelete(browser);
    const createSaveError = await runCreateSaveError(browser);
    const editSaveError = await runEditSaveError(browser);
    const attendanceNormal = await runAttendanceNormal(browser);
    const attendanceLoadError = await runAttendanceLoadError(browser);
    const extraDayRequestError = await runExtraDayRequestError(browser);
    [normal, loadError, detailLoadError, detailDelete, createSaveError, editSaveError, attendanceNormal, attendanceLoadError, extraDayRequestError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      createPayload: createSaveError.state.createPayload,
      detailDeletedScheduleId: detailDelete.state.deletedScheduleId,
      deletedScheduleId: normal.state.deletedScheduleId,
      editPayload: editSaveError.state.editPayload,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
      extraDayPayload: extraDayRequestError.state.extraDayPayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
