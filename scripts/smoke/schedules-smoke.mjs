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
  return { externalContinues: [], hits: [], deletedScheduleId: null, ...overrides };
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
    if (method === 'DELETE' && path === '/schedules/101') {
      state.deletedScheduleId = 101;
      return jsonRoute(route, { message: 'deleted' });
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
  page.on('dialog', async (dialog) => dialog.accept());

  await page.goto('/schedules', { waitUntil: 'networkidle' });
  await page.getByTestId('schedules-workspace').waitFor();
  await page.getByRole('heading', { name: '수업 관리' }).waitFor();
  await page.getByText(`${range.year}년 ${range.month + 1}월`).waitFor();
  await page.getByText('승인 대기').waitFor();
  await assertNoRawVisibleText(page, 'schedules desktop');
  await assertNoHorizontalOverflow(page, 'schedules desktop');
  await page.screenshot({ path: '/Users/etlab/paca-schedules-desktop.png', fullPage: true });

  await page.getByRole('button', { name: '목록' }).click();
  await page.getByText('오후 실기 집중반').waitFor();
  await page.getByRole('button', { name: '삭제' }).click();
  await page.getByText('수업이 삭제되었습니다.').waitFor();
  if (state.deletedScheduleId !== 101) throw new Error('schedule delete endpoint not called');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('schedules-workspace').waitFor();
  await assertNoRawVisibleText(page, 'schedules mobile');
  await assertNoHorizontalOverflow(page, 'schedules mobile');
  await page.screenshot({ path: '/Users/etlab/paca-schedules-mobile.png', fullPage: true });

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

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const normal = await runNormal(browser);
    const loadError = await runLoadError(browser);
    [normal, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      deletedScheduleId: normal.state.deletedScheduleId,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
