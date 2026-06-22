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

const seasons = [
  {
    id: 88,
    academy_id: 1,
    season_name: '2026 정시 집중반',
    season_type: 'regular',
    season_start_date: '2026-07-01',
    season_end_date: '2026-12-10',
    non_season_end_date: '2026-06-30',
    operating_days: [1, 3, 5],
    grade_time_slots: { 고3: ['afternoon', 'evening'] },
    default_season_fee: '1500000',
    allows_continuous: true,
    continuous_to_season_type: 'early',
    continuous_discount_type: 'rate',
    continuous_discount_rate: 20,
    status: 'active',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 77,
    academy_id: 1,
    season_name: '2026 수시 실전반',
    season_type: 'early',
    season_start_date: '2026-03-01',
    season_end_date: '2026-06-20',
    non_season_end_date: null,
    operating_days: '[2,4,6]',
    grade_time_slots: null,
    default_season_fee: '1200000',
    allows_continuous: false,
    continuous_to_season_type: null,
    continuous_discount_type: 'none',
    continuous_discount_rate: 0,
    status: 'draft',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
];

function makeState(overrides = {}) {
  return { deletedSeasonId: null, externalContinues: [], hits: [], ...overrides };
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

    if (state.failLoad && method === 'GET' && path === '/seasons') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'GET' && path === '/seasons') {
      const seasonType = url.searchParams.get('season_type');
      const status = url.searchParams.get('status');
      const filtered = seasons.filter((season) =>
        (!seasonType || season.season_type === seasonType) &&
        (!status || season.status === status)
      );
      return jsonRoute(route, { message: 'ok', seasons: filtered });
    }
    if (method === 'DELETE' && path === '/seasons/88') {
      state.deletedSeasonId = 88;
      return jsonRoute(route, { message: 'deleted' });
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

  await page.goto('/seasons', { waitUntil: 'networkidle' });
  await page.getByTestId('season-list-workspace').waitFor();
  await page.getByRole('heading', { name: '시즌 관리' }).waitFor();
  await page.locator('[data-testid="season-row"]:has-text("2026 정시 집중반")').first().waitFor();
  await page.locator('[data-testid="season-row"]:has-text("2026 수시 실전반")').first().waitFor();
  await assertNoRawVisibleText(page, 'season list desktop');
  await assertNoHorizontalOverflow(page, 'season list desktop');
  await page.screenshot({ path: '/Users/etlab/paca-season-list-desktop.png', fullPage: true });

  await page.getByLabel('시즌 타입').selectOption('regular');
  await page.locator('[data-testid="season-row"]:has-text("2026 수시 실전반")').waitFor({ state: 'detached' });
  if (!state.hits.some((hit) => hit.includes('/seasons?season_type=regular'))) {
    throw new Error(`missing regular filter request: ${state.hits.join(' | ')}`);
  }

  await page.locator('[data-testid="season-row"]:has-text("2026 정시 집중반")').getByRole('button', { name: '삭제' }).click();
  await page.getByText('시즌이 삭제되었습니다.').waitFor();
  if (state.deletedSeasonId !== 88) throw new Error('season delete endpoint not called');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('season-list-workspace').waitFor();
  await assertNoRawVisibleText(page, 'season list mobile');
  await assertNoHorizontalOverflow(page, 'season list mobile');
  await page.screenshot({ path: '/Users/etlab/paca-season-list-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons', { waitUntil: 'networkidle' });
  await page.getByText('시즌 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'season list error');
  await assertNoHorizontalOverflow(page, 'season list error');
  await page.screenshot({ path: '/Users/etlab/paca-season-list-error-mobile.png', fullPage: true });

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
      deletedSeasonId: normal.state.deletedSeasonId,
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
