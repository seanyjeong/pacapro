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

const SCHEDULES = [
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

function makeState(mode = 'success') {
  return { assignmentPayload: null, hits: [], mode };
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

    if (method === 'GET' && path === '/schedules') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, { schedules: SCHEDULES });
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

    if (method === 'GET' && path === `/schedules/date/${range.today}/instructor-schedules`) {
      const schedulesBySlot = { afternoon: [], evening: [], morning: [] };
      (state.assignmentPayload?.schedules || []).forEach((schedule) => {
        schedulesBySlot[schedule.time_slot].push({
          instructor_id: schedule.instructor_id,
          instructor_name: schedule.instructor_id === 3 ? '박코치' : '김코치',
          salary_type: schedule.instructor_id === 3 ? 'hourly' : 'monthly',
          scheduled_start_time: schedule.scheduled_start_time,
          scheduled_end_time: schedule.scheduled_end_time,
        });
      });

      return jsonRoute(route, {
        instructors: [
          { id: 3, name: '박코치', salary_type: 'hourly' },
          { id: 4, name: '김코치', salary_type: 'monthly' },
        ],
        schedules: schedulesBySlot,
      });
    }

    if (method === 'POST' && path === `/schedules/date/${range.today}/instructor-schedules`) {
      state.assignmentPayload = request.postDataJSON();
      return jsonRoute(route, { message: 'saved' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createTabletSchedulePage(browser, mode, viewport) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function runNormal(browser, viewport, label) {
  const result = await createTabletSchedulePage(browser, 'success', viewport);
  const { context, page, state } = result;

  await page.goto('/tablet/schedule', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '오늘 수업 운영' }).waitFor();
  await page.getByText('오후 실기 집중반').waitFor();
  await page.getByText('박코치').waitFor();
  await page.getByLabel('선택일 운영').getByText('8명', { exact: true }).waitFor();
  const attendanceHref = await page
    .getByRole('link', { name: '오후 실기 집중반 출석 체크' })
    .getAttribute('href');
  if (attendanceHref !== '/schedules/101/attendance') {
    throw new Error(`attendance href mismatch: ${attendanceHref}`);
  }
  const classDaysHref = await page.getByRole('link', { name: '수업일관리' }).getAttribute('href');
  if (classDaysHref !== '/students/class-days') {
    throw new Error(`class days href mismatch: ${classDaysHref}`);
  }
  if (!state.hits.some((hit) => hit.includes(`/schedules?start_date=${range.start}&end_date=${range.end}`))) {
    throw new Error(`missing schedules month request: ${state.hits.join(' | ')}`);
  }
  await assertNoRawVisibleText(page, `tablet schedule ${label}`);
  await assertNoHorizontalOverflow(page, `tablet schedule ${label}`);
  await page.screenshot({ path: `/Users/etlab/paca-tablet-schedule-${label}.png`, fullPage: true });

  await context.close();
  return result;
}

async function runInstructorAssignmentSave(browser) {
  const result = await createTabletSchedulePage(browser, 'success', { width: 1180, height: 820 });
  const { context, page, state } = result;

  await page.goto('/tablet/schedule', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '오늘 수업 운영' }).waitFor();
  await page.getByRole('button', { name: '강사 배정', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: '강사 근무 배정' }).waitFor();
  await dialog.getByRole('button', { name: /박코치/ }).click();
  await dialog.locator('input[type="time"]').first().fill('10:00');
  await dialog.locator('input[type="time"]').nth(1).fill('12:30');

  const saveResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().includes(`/schedules/date/${range.today}/instructor-schedules`)
  ));
  await dialog.getByRole('button', { name: '저장' }).click();
  await saveResponse;
  await dialog.getByText('현재 1명').waitFor();

  const submitted = state.assignmentPayload?.schedules?.[0];
  if (
    submitted?.instructor_id !== 3
    || submitted?.time_slot !== 'morning'
    || submitted?.scheduled_start_time !== '10:00'
    || submitted?.scheduled_end_time !== '12:30'
  ) {
    throw new Error(`unexpected instructor assignment payload: ${JSON.stringify(state.assignmentPayload)}`);
  }

  await assertNoRawVisibleText(page, 'tablet schedule instructor assignment');
  await assertNoHorizontalOverflow(page, 'tablet schedule instructor assignment');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-schedule-assignment.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createTabletSchedulePage(browser, 'load-error', { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/schedule', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '수업 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByText('잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'tablet schedule load error');
  await assertNoHorizontalOverflow(page, 'tablet schedule load error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-schedule-load-error.png', fullPage: true });

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
    const landscape = await runNormal(browser, { width: 1180, height: 820 }, 'landscape');
    const portrait = await runNormal(browser, { width: 820, height: 1180 }, 'portrait');
    const assignment = await runInstructorAssignmentSave(browser);
    const loadError = await runLoadError(browser);
    [landscape, portrait, assignment, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      assignmentPayload: assignment.state.assignmentPayload,
      landscapeHits: landscape.state.hits,
      loadErrorHits: loadError.state.hits,
      portraitHits: portrait.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
