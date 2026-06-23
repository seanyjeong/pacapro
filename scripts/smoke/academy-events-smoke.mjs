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
    today: formatDate(date),
    yearMonth: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
  };
}

const range = monthRange();

function makeEvent(overrides = {}) {
  return {
    id: 901,
    academy_id: 1,
    title: '월말 운영 회의',
    description: '지점 운영 점검',
    event_type: 'work',
    event_date: range.today,
    start_time: '13:00:00',
    end_time: '15:00:00',
    is_all_day: false,
    is_holiday: false,
    color: '#f59e0b',
    created_by: 1,
    created_by_name: '원장',
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    ...overrides,
  };
}

function makeState(mode) {
  return { createPayload: null, hits: [], mode };
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

    if (method === 'GET' && path === '/academy-events') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, { events: [makeEvent()] });
    }

    if (method === 'POST' && path === '/academy-events') {
      state.createPayload = JSON.parse(request.postData() || '{}');
      if (state.mode === 'create-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, { event: makeEvent({ id: 902, ...state.createPayload }) });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function gotoAcademyEvents(page) {
  const eventsResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET' && normalizePacaApiPath(url) === '/academy-events';
  });
  await page.goto('/academy-events', { waitUntil: 'domcontentloaded' });
  await eventsResponse;
}

async function assertOperationsBoard(page) {
  const board = page.getByTestId('academy-events-operations-board');
  await board.getByRole('heading', { name: '일정 작업 보드' }).waitFor();
  await board.getByTestId('academy-events-metric-month').getByText('1건').waitFor();
  await board.getByTestId('academy-events-metric-today').getByText('1건').waitFor();
  await board.getByTestId('academy-events-metric-holiday').getByText('0건').waitFor();
  await board.getByTestId('academy-events-metric-work').getByText('1건').waitFor();
  await board.getByRole('button', { name: '새 일정 등록' }).waitFor();
}

async function runDesktop(browser) {
  const result = await createPage(browser, 'success');
  const { context, page } = result;

  await gotoAcademyEvents(page);
  await page.getByRole('heading', { level: 1, name: '학원일정' }).waitFor();
  await assertOperationsBoard(page);
  await page.getByRole('button', { name: '월말 운영 회의 수정' }).waitFor();
  await assertNoRawVisibleText(page, 'academy events desktop');
  await assertNoHorizontalOverflow(page, 'academy events desktop');
  await page.screenshot({ path: '/Users/etlab/paca-academy-events-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobile(browser) {
  const result = await createPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await gotoAcademyEvents(page);
  await page.getByRole('heading', { level: 1, name: '학원일정' }).waitFor();
  await assertOperationsBoard(page);
  await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.getByRole('button', { name: '월말 운영 회의 수정' }).waitFor();
  await assertNoRawVisibleText(page, 'academy events mobile');
  await assertNoHorizontalOverflow(page, 'academy events mobile');
  await page.screenshot({ path: '/Users/etlab/paca-academy-events-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await gotoAcademyEvents(page);
  await page.getByText('학원 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'academy events load error');
  await assertNoHorizontalOverflow(page, 'academy events load error');
  await page.screenshot({ path: '/Users/etlab/paca-academy-events-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runCreateError(browser) {
  const result = await createPage(browser, 'create-error', { width: 390, height: 844 });
  const { context, page } = result;

  await gotoAcademyEvents(page);
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '일정 등록' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: '일정 등록 닫기' }).waitFor();
  await dialog.getByPlaceholder('일정 제목').fill('저장 실패 테스트');
  await dialog.locator('form button[type="submit"]').click();
  await dialog.locator('form').getByText('저장 실패').waitFor();
  await dialog.locator('form').getByText('학원 일정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  if (result.state.createPayload?.event_date !== range.today) {
    throw new Error(`default event date mismatch: ${result.state.createPayload?.event_date} !== ${range.today}`);
  }
  await assertNoRawVisibleText(page, 'academy events create error');
  await assertNoHorizontalOverflow(page, 'academy events create error');
  await page.screenshot({ path: '/Users/etlab/paca-academy-events-create-error-mobile.png', fullPage: true });

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
    const createError = await runCreateError(browser);
    [desktop, mobile, loadError, createError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      createPayload: createError.state.createPayload,
      desktopHits: desktop.state.hits,
      loadErrorHits: loadError.state.hits,
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
