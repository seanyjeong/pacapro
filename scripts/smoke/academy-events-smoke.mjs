import assert from 'node:assert/strict';
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
    block_consultation: true,
    color: '#f59e0b',
    created_by: 1,
    created_by_name: '원장',
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    ...overrides,
  };
}

function makeState(mode) {
  return { createPayload: null, updatePayload: null, events: [makeEvent()], hits: [], mode };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'supermax.kr';

    if (!isApi) return route.continue();

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);
    if (path.startsWith('/academy-events') && method !== 'OPTIONS') {
      assert.equal(request.headers().authorization, 'Bearer smoke-token', 'event API must retain auth header');
    }

    if (method === 'GET' && path === '/academy-events') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, { events: state.events });
    }

    if (method === 'POST' && path === '/academy-events') {
      state.createPayload = JSON.parse(request.postData() || '{}');
      if (state.mode === 'create-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      const event = makeEvent({ id: 901 + state.events.length, ...state.createPayload });
      state.events.push(event);
      return jsonRoute(route, { event }, 201);
    }

    if (method === 'PUT' && path.startsWith('/academy-events/')) {
      state.updatePayload = JSON.parse(request.postData() || '{}');
      const id = Number(path.split('/').at(-1));
      state.events = state.events.map(event => event.id === id ? { ...event, ...state.updatePayload } : event);
      return jsonRoute(route, { event: state.events.find(event => event.id === id) });
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
  page.on('requestfailed', request => diagnostics.consoleErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  return { context, diagnostics, page, state };
}

async function gotoAcademyEvents(page) {
  const eventsResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET' && normalizePacaApiPath(url) === '/academy-events';
  });
  await page.goto('/academy-events', { waitUntil: 'domcontentloaded' });
  await eventsResponse;
  await page.getByTestId('academy-events-workspace').waitFor();
}

async function assertOperationsBoard(page) {
  const board = page.getByTestId('academy-events-operations-board');
  await board.getByRole('heading', { name: '일정 작업 보드' }).waitFor();
  await board.getByTestId('academy-events-metric-month').getByText('1건').waitFor();
  await board.getByTestId('academy-events-metric-today').getByText('1건').waitFor();
  await board.getByTestId('academy-events-metric-holiday').getByText('0건').waitFor();
  await board.getByTestId('academy-events-metric-work').getByText('1건').waitFor();
  await board.getByRole('button', { name: '새 일정 등록' }).waitFor();
  const settingsHref = await board.getByRole('link', { name: '상담 시간 설정' }).getAttribute('href');
  assert.equal(settingsHref, '/consultations/settings');
  const settingsResponse = await page.request.get(settingsHref);
  assert.equal(settingsResponse.status(), 200, 'consultation settings link must resolve');
  assert.equal(new URL(settingsResponse.url()).pathname, settingsHref);
}

async function runDesktop(browser) {
  const result = await createPage(browser, 'success');
  const { context, page } = result;

  await gotoAcademyEvents(page);
  await page.getByRole('heading', { level: 1, name: '학원일정' }).waitFor();
  await assertOperationsBoard(page);
  await page
    .getByTestId('academy-events-operations-board')
    .getByRole('button', { name: '월말 운영 회의 일정 수정' })
    .click();
  const editDialog = page.getByRole('dialog', { name: '일정 수정' });
  await editDialog.waitFor();
  await editDialog.getByPlaceholder('일정 제목').waitFor();
  if ((await editDialog.getByPlaceholder('일정 제목').inputValue()) !== '월말 운영 회의') {
    throw new Error('operations board upcoming event did not open the selected event');
  }
  const toggle = editDialog.getByRole('switch', { name: '상담 차단' });
  assert.equal(await toggle.getAttribute('aria-checked'), 'true', 'existing blocks must be shown');
  assert.equal(await editDialog.getByRole('combobox').first().inputValue(), '13:00', 'stored times must be visible');
  await toggle.click();
  await editDialog.getByRole('button', { name: '수정', exact: true }).click();
  await editDialog.waitFor({ state: 'hidden' });
  assert.equal(result.state.updatePayload.block_consultation, false);
  await page.getByTestId('academy-events-operations-board')
    .getByRole('button', { name: '월말 운영 회의 일정 수정' }).click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'false', 'saved block opt-out must be shown');
  await editDialog.getByRole('button', { name: '일정 수정 닫기' }).click();
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

async function runOptInFlow(browser, viewport, label) {
  const result = await createPage(browser, 'success', viewport);
  const { context, page, state } = result;
  await gotoAcademyEvents(page);
  const dialog = page.getByRole('dialog', { name: '일정 등록' });
  const toggle = dialog.getByRole('switch', { name: '상담 차단' });

  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'false', 'new events default to no block');
  await dialog.getByPlaceholder('일정 제목').fill('상담 허용 일정');
  await dialog.getByRole('button', { name: '휴일', exact: true }).click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'false', 'holiday must not silently enable blocking');
  await dialog.getByRole('button', { name: '등록', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(state.createPayload.block_consultation, false);
  assert.equal(state.createPayload.is_holiday, true);

  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'false', 'new form must reset');
  await dialog.getByPlaceholder('일정 제목').fill('상담 차단 일정');
  await dialog.getByLabel('종일', { exact: true }).uncheck();
  await toggle.click();
  await dialog.getByRole('button', { name: '등록', exact: true }).click();
  await dialog.getByText('상담을 차단할 시작 시간과 종료 시간을 확인해주세요.').waitFor();
  assert.equal(state.createPayload.title, '상담 허용 일정', 'invalid times must not be sent');
  await dialog.getByRole('button', { name: '오후', exact: true }).click();
  await toggle.scrollIntoViewIfNeeded();
  const bounds = await dialog.boundingBox();
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, 'dialog must fit viewport');
  await assertNoHorizontalOverflow(page, `academy events opt-in ${label}`);
  await assertNoRawVisibleText(page, `academy events opt-in ${label}`);
  await dialog.getByRole('button', { name: '등록', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(state.createPayload.block_consultation, true);
  assert.equal(state.createPayload.is_holiday, false);
  assert.equal(state.createPayload.start_time, '13:00');
  await page.getByRole('button', { name: '상담 차단 일정 수정', exact: true }).click();
  const edit = page.getByRole('dialog', { name: '일정 수정' });
  assert.equal(await edit.getByRole('switch', { name: '상담 차단' }).getAttribute('aria-checked'), 'true');
  await edit.getByRole('switch', { name: '상담 차단' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/Users/etlab/paca-academy-events-opt-in-${label}.png`, fullPage: true });
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
  await dialog.getByRole('switch', { name: '상담 차단' }).click();
  await dialog.locator('form button[type="submit"]').click();
  await dialog.locator('form').getByText('저장 실패').waitFor();
  await dialog.locator('form').getByText('학원 일정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  if (result.state.createPayload?.event_date !== range.today) {
    throw new Error(`default event date mismatch: ${result.state.createPayload?.event_date} !== ${range.today}`);
  }
  assert.equal(await dialog.getByRole('switch', { name: '상담 차단' }).getAttribute('aria-checked'), 'true');
  await assertNoRawVisibleText(page, 'academy events create error');
  await assertNoHorizontalOverflow(page, 'academy events create error');
  await page.screenshot({ path: '/Users/etlab/paca-academy-events-create-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
  if (result.state.mode === 'success') {
    assert.deepEqual(result.diagnostics.consoleErrors, [], 'successful flows must not have console or network errors');
  }
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const desktop = await runDesktop(browser);
    const mobile = await runMobile(browser);
    const loadError = await runLoadError(browser);
    const createError = await runCreateError(browser);
    const optInDesktop = await runOptInFlow(browser, { width: 1365, height: 900 }, 'desktop');
    const optInMobile = await runOptInFlow(browser, { width: 390, height: 844 }, 'mobile');
    [desktop, mobile, loadError, createError, optInDesktop, optInMobile].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      createPayload: createError.state.createPayload,
      desktopHits: desktop.state.hits,
      loadErrorHits: loadError.state.hits,
      mobileHits: mobile.state.hits,
      normalConsoleErrors: desktop.diagnostics.consoleErrors,
      optInPayload: optInMobile.state.createPayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
