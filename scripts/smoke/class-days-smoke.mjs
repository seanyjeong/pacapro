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

function makeState(mode) {
  return { bulkPayload: null, hits: [], mode };
}

function makeStudents() {
  return [
    {
      id: 41,
      name: '김진우',
      grade: '고2',
      class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
      weekly_count: 2,
      time_slot: 'evening',
      class_days_next: null,
      class_days_effective_from: null,
    },
    {
      id: 42,
      name: '박서연',
      grade: '고3',
      class_days: [{ day: 2, timeSlot: 'afternoon' }, { day: 4, timeSlot: 'afternoon' }],
      weekly_count: 2,
      time_slot: 'afternoon',
      class_days_next: [{ day: 2, timeSlot: 'afternoon' }, { day: 5, timeSlot: 'afternoon' }],
      class_days_effective_from: '2026-07-01',
    },
  ];
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

    if (method === 'GET' && path === '/students/class-days') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'ok', students: makeStudents() });
    }

    if (method === 'PUT' && path === '/students/class-days/bulk') {
      state.bulkPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: '수업일 변경이 저장되었습니다.', mode: 'immediate', results: [{ id: 41, success: true }] });
    }

    if (method === 'DELETE' && path === '/students/42/class-days-schedule') {
      return jsonRoute(route, { message: '취소되었습니다.' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createClassDaysPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, page, state, diagnostics };
}

async function runDesktopSave(browser) {
  const result = await createClassDaysPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/students/class-days', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '수업일 관리' }).waitFor();
  await page.locator('tbody tr').filter({ hasText: '김진우' }).getByRole('button', { name: '화' }).click();
  await page.getByRole('button', { name: /저장/ }).click();
  await page.getByText('수업일 변경이 저장되었습니다.').waitFor();

  if (!state.bulkPayload) throw new Error('class-days bulk payload was not sent');
  if (state.bulkPayload.students?.[0]?.id !== 41) throw new Error(`student id mismatch: ${JSON.stringify(state.bulkPayload)}`);
  if (!state.bulkPayload.students[0].class_days.some((slot) => slot.day === 2)) {
    throw new Error(`Tuesday was not included: ${JSON.stringify(state.bulkPayload)}`);
  }

  await assertNoRawVisibleText(page, 'class days desktop');
  await assertNoHorizontalOverflow(page, 'class days desktop');
  await page.screenshot({ path: '/Users/etlab/paca-class-days-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createClassDaysPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students/class-days', { waitUntil: 'domcontentloaded' });
  await page.getByText('수업일 목록을 불러오지 못했습니다').waitFor();
  await assertNoRawVisibleText(page, 'class days load error');
  await assertNoHorizontalOverflow(page, 'class days load error');
  await page.screenshot({ path: '/Users/etlab/paca-class-days-error-mobile.png', fullPage: true });

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
    const desktop = await runDesktopSave(browser);
    const loadError = await runLoadError(browser);
    [desktop, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      bulkPayload: desktop.state.bulkPayload,
      errorConsoleErrors: loadError.diagnostics.consoleErrors,
      errorHits: loadError.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
