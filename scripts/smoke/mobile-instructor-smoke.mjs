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

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeAttendanceResponse() {
  const today = toLocalDateStr(new Date());
  return {
    message: 'Instructor attendance retrieved',
    date: today,
    instructors: [],
    instructors_by_slot: {
      morning: [
        { id: 201, name: '강민호', salary_type: 'hourly', source: 'scheduled' },
        { id: 202, name: '이수현', salary_type: 'hourly', source: 'scheduled' },
      ],
      afternoon: [
        { id: 203, name: '박지원', salary_type: 'monthly', source: 'approved' },
      ],
      evening: [],
    },
    attendances: [
      {
        id: 501,
        instructor_id: 202,
        instructor_name: '이수현',
        time_slot: 'morning',
        attendance_status: 'late',
      },
    ],
  };
}

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], submissions: [], ...overrides };
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

    if (state.failLoad && method === 'GET' && /\/schedules\/date\/[^/]+\/instructor-attendance$/.test(path)) {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'GET' && /\/schedules\/date\/[^/]+\/instructor-attendance$/.test(path)) {
      return jsonRoute(route, makeAttendanceResponse());
    }
    if (state.failSave && method === 'POST' && /\/schedules\/date\/[^/]+\/instructor-attendance$/.test(path)) {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'POST' && /\/schedules\/date\/[^/]+\/instructor-attendance$/.test(path)) {
      state.submissions.push(request.postDataJSON());
      return jsonRoute(route, { message: 'saved' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createMobilePage(browser, state) {
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  return { context, page, diagnostics };
}

async function gotoWorkspace(page) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto('/m/instructor', { waitUntil: 'domcontentloaded' });
    try {
      await page.getByTestId('mobile-instructor-workspace').waitFor({ timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return;
    } catch (error) {
      if (attempt === 2) {
        const body = await page.locator('body').innerText().catch(() => '');
        throw new Error(`mobile instructor workspace did not render at ${page.url()}: ${body.slice(0, 500)}\n${error.message}`);
      }
      await page.waitForTimeout(500);
    }
  }
}

async function runNormal(browser) {
  const state = makeState();
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  const workspace = page.getByTestId('mobile-instructor-workspace');
  await workspace.getByRole('heading', { name: '강사 출근체크' }).waitFor();
  await workspace.getByTestId('mobile-instructor-card').filter({ hasText: '강민호' }).getByRole('button', { name: '출근' }).click();
  await workspace.getByTestId('mobile-instructor-card').filter({ hasText: '이수현' }).getByRole('button', { name: '지각' }).click();
  await workspace.getByRole('button', { name: '오후 전체 출근' }).click();
  await workspace.getByRole('button', { name: /저장/ }).click();
  await page.getByText('강사 출근이 저장되었습니다.').waitFor();

  const records = state.submissions.at(-1)?.attendances || [];
  const byInstructor = new Map(records.map((record) => [`${record.instructor_id}-${record.time_slot}`, record]));
  if (byInstructor.get('201-morning')?.attendance_status !== 'present') {
    throw new Error(`present payload mismatch: ${JSON.stringify(records)}`);
  }
  if (byInstructor.get('202-morning')?.attendance_status !== 'none') {
    throw new Error(`clear payload mismatch: ${JSON.stringify(records)}`);
  }
  if (byInstructor.get('203-afternoon')?.attendance_status !== 'present') {
    throw new Error(`afternoon all-present payload mismatch: ${JSON.stringify(records)}`);
  }

  await assertNoRawVisibleText(page, 'mobile instructor normal');
  await assertNoHorizontalOverflow(page, 'mobile instructor normal');
  await page.screenshot({ path: '/Users/etlab/paca-mobile-instructor.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await page.getByText('강사 출근 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile instructor load error');
  await assertNoHorizontalOverflow(page, 'mobile instructor load error');
  await page.screenshot({ path: '/Users/etlab/paca-mobile-instructor-load-error.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runSaveError(browser) {
  const state = makeState({ failSave: true });
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  const workspace = page.getByTestId('mobile-instructor-workspace');
  await workspace.getByTestId('mobile-instructor-card').filter({ hasText: '강민호' }).getByRole('button', { name: '출근' }).click();
  await workspace.getByRole('button', { name: /저장/ }).click();
  await page.getByText('강사 출근 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile instructor save error');
  await assertNoHorizontalOverflow(page, 'mobile instructor save error');
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
    const saveError = await runSaveError(browser);
    [normal, loadError, saveError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      submissions: normal.state.submissions,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
      saveErrorConsoleErrors: saveError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
