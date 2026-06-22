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
      if (state.mode === 'save-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
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
  await page.locator('tbody tr').filter({ hasText: '김진우' }).getByLabel('김진우 선택').click();
  await page.locator('tbody tr').filter({ hasText: '박서연' }).getByLabel('박서연 선택').click();
  await page.getByRole('button', { name: '일괄 화요일 선택' }).click();
  await page.getByRole('button', { name: '일괄 금요일 선택' }).click();
  await page.getByLabel('일괄 화요일 시간대').selectOption('morning');
  await page.getByLabel('일괄 금요일 시간대').selectOption('afternoon');
  await page.getByRole('button', { name: '선택 학생에 적용' }).click();
  await page.getByText('2명 변경됨').waitFor();
  await page.getByRole('button', { name: /저장/ }).click();
  await page.getByText('수업일 변경이 저장되었습니다.').waitFor();

  if (!state.bulkPayload) throw new Error('class-days bulk payload was not sent');
  if (state.bulkPayload.students?.length !== 2) throw new Error(`student count mismatch: ${JSON.stringify(state.bulkPayload)}`);
  for (const student of state.bulkPayload.students) {
    const tuesday = student.class_days.find((slot) => slot.day === 2);
    const friday = student.class_days.find((slot) => slot.day === 5);
    if (!tuesday || !friday) {
      throw new Error(`bulk weekdays were not included: ${JSON.stringify(state.bulkPayload)}`);
    }
    if (tuesday.timeSlot !== 'morning') throw new Error(`Tuesday time slot mismatch: ${JSON.stringify(state.bulkPayload)}`);
    if (friday.timeSlot !== 'afternoon') throw new Error(`Friday time slot mismatch: ${JSON.stringify(state.bulkPayload)}`);
  }

  await assertNoRawVisibleText(page, 'class days desktop');
  await assertNoHorizontalOverflow(page, 'class days desktop');
  await page.screenshot({ path: '/Users/etlab/paca-class-days-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '수업일 관리' }).waitFor();
  const jinwooCard = page.locator('article').filter({ hasText: '김진우' });
  await jinwooCard.waitFor();
  await jinwooCard.getByRole('button', { name: '김진우 화요일 선택' }).waitFor();
  await assertNoRawVisibleText(page, 'class days mobile');
  await assertNoHorizontalOverflow(page, 'class days mobile');
  await page.screenshot({ path: '/Users/etlab/paca-class-days-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runSaveError(browser) {
  const result = await createClassDaysPage(browser, 'save-error');
  const { context, page } = result;

  await page.goto('/students/class-days', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '수업일 관리' }).waitFor();
  await page.locator('tbody tr').filter({ hasText: '김진우' }).getByRole('button', { name: '김진우 화요일 선택' }).click();
  await page.getByRole('button', { name: /저장/ }).click();
  await page.getByRole('alert').getByRole('heading', { name: '저장 실패' }).waitFor();
  await page.getByText('수업일 변경을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'class days save error');
  await assertNoHorizontalOverflow(page, 'class days save error');
  await page.screenshot({ path: '/Users/etlab/paca-class-days-save-error-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createClassDaysPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students/class-days', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '수업일 관리' }).waitFor();
  await page.getByRole('alert').getByRole('heading', { name: '수업일 목록을 불러오지 못했습니다' }).waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
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
    const saveError = await runSaveError(browser);
    const loadError = await runLoadError(browser);
    [desktop, saveError, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      bulkPayload: desktop.state.bulkPayload,
      saveErrorHits: saveError.state.hits,
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
