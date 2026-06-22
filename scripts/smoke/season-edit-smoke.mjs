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

const season = {
  id: 88,
  academy_id: 1,
  season_name: '2027 정시 집중반',
  season_type: 'regular',
  season_start_date: '2027-07-01',
  season_end_date: '2027-12-15',
  non_season_end_date: '2027-06-30',
  operating_days: '[1,3,5]',
  grade_time_slots: '{"고3":"evening","N수":["morning"]}',
  default_season_fee: '1500000',
  allows_continuous: false,
  continuous_to_season_type: null,
  continuous_discount_type: 'none',
  continuous_discount_rate: 0,
  status: 'upcoming',
  created_at: '2026-06-22T09:00:00Z',
  updated_at: '2026-06-22T09:00:00Z',
};

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], updatePayloads: [], ...overrides };
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

    if (state.failLoad && method === 'GET' && path === '/seasons/88') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'GET' && path === '/seasons/88') {
      return jsonRoute(route, { message: 'ok', season });
    }
    if (state.failUpdate && method === 'PUT' && path === '/seasons/88') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'PUT' && path === '/seasons/88') {
      const payload = request.postDataJSON();
      state.updatePayloads.push(payload);
      return jsonRoute(route, {
        message: 'updated',
        season: {
          ...season,
          ...payload,
          id: 88,
          season_start_date: payload.season_start_date,
          season_end_date: payload.season_end_date,
          default_season_fee: String(payload.default_season_fee),
          updated_at: '2026-06-22T10:00:00Z',
        },
        scheduleAssignment: payload.status === 'active' ? { assigned: 2 } : null,
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function editForm(page) {
  const workspace = page.getByTestId('season-edit-workspace');
  await workspace.getByLabel('시즌명 *').fill('2027 정시 집중반 수정');
  await workspace.getByLabel('상태').selectOption('active');
  await workspace.getByLabel('기본 시즌비 (원)').fill('1600000');
  await workspace.getByLabel('할인 타입').selectOption('rate');
  await workspace.getByLabel('할인율 (%)').fill('10');
  await workspace.getByRole('button', { name: '화' }).click();
  await workspace.getByRole('button', { name: '금' }).click();
  await workspace.getByText('고3').locator('..').getByRole('button', { name: '오후' }).click();
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/88/edit', { waitUntil: 'networkidle' });
  await page.getByTestId('season-edit-workspace').waitFor();
  await page.getByRole('heading', { name: '시즌 수정' }).waitFor();
  const initialName = await page.getByLabel('시즌명 *').inputValue();
  if (initialName !== '2027 정시 집중반') throw new Error(`season name not loaded: ${initialName}`);
  await assertNoRawVisibleText(page, 'season edit desktop');
  await assertNoHorizontalOverflow(page, 'season edit desktop');
  await page.screenshot({ path: '/Users/etlab/paca-season-edit-desktop.png', fullPage: true });

  await editForm(page);
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL('**/seasons/88');

  const payload = state.updatePayloads.at(-1);
  if (!payload) throw new Error('season update endpoint not called');
  if (payload.season_name !== '2027 정시 집중반 수정') throw new Error(`unexpected name: ${JSON.stringify(payload)}`);
  if (payload.status !== 'active') throw new Error(`unexpected status: ${JSON.stringify(payload)}`);
  if (payload.default_season_fee !== 1600000) throw new Error(`unexpected fee: ${JSON.stringify(payload)}`);
  if (payload.allows_continuous !== true) throw new Error(`unexpected continuous flag: ${JSON.stringify(payload)}`);
  if (payload.continuous_to_season_type !== 'regular') throw new Error(`unexpected continuous target: ${JSON.stringify(payload)}`);
  if (payload.continuous_discount_type !== 'rate') throw new Error(`unexpected discount type: ${JSON.stringify(payload)}`);
  if (payload.continuous_discount_rate !== 10) throw new Error(`unexpected discount rate: ${JSON.stringify(payload)}`);
  if (!payload.operating_days.includes(2) || payload.operating_days.includes(5)) {
    throw new Error(`operating day update failed: ${JSON.stringify(payload)}`);
  }
  if (!payload.grade_time_slots['고3'].includes('afternoon')) {
    throw new Error(`grade slot update failed: ${JSON.stringify(payload)}`);
  }

  await context.close();
  return { state, diagnostics };
}

async function runMobile(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/88/edit', { waitUntil: 'networkidle' });
  await page.getByTestId('season-edit-workspace').waitFor();
  await assertNoRawVisibleText(page, 'season edit mobile');
  await assertNoHorizontalOverflow(page, 'season edit mobile');
  await page.screenshot({ path: '/Users/etlab/paca-season-edit-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/88/edit', { waitUntil: 'networkidle' });
  await page.getByText('시즌 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'season edit load error');
  await assertNoHorizontalOverflow(page, 'season edit load error');
  await page.screenshot({ path: '/Users/etlab/paca-season-edit-load-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runUpdateError(browser) {
  const state = makeState({ failUpdate: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/88/edit', { waitUntil: 'networkidle' });
  await page.getByTestId('season-edit-workspace').waitFor();
  await editForm(page);
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByText('시즌을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'season edit update error');
  await assertNoHorizontalOverflow(page, 'season edit update error');
  await page.screenshot({ path: '/Users/etlab/paca-season-edit-update-error-mobile.png', fullPage: true });

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
    const mobile = await runMobile(browser);
    const loadError = await runLoadError(browser);
    const updateError = await runUpdateError(browser);
    [normal, mobile, loadError, updateError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      updatePayload: normal.state.updatePayloads.at(-1),
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      mobileConsoleErrors: mobile.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
      updateErrorConsoleErrors: updateError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
