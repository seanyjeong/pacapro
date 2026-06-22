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

function makeState(overrides = {}) {
  return { createPayloads: [], externalContinues: [], hits: [], ...overrides };
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

    if (state.failCreate && method === 'POST' && path === '/seasons') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'POST' && path === '/seasons') {
      const payload = request.postDataJSON();
      state.createPayloads.push(payload);
      return jsonRoute(route, {
        message: 'created',
        season: {
          id: 91,
          academy_id: 1,
          ...payload,
          season_start_date: payload.season_start_date,
          season_end_date: payload.season_end_date,
          default_season_fee: String(payload.default_season_fee),
          allows_continuous: payload.continuous_discount_type !== 'none',
          continuous_to_season_type: payload.season_type === 'early' ? 'regular' : null,
          created_at: '2026-06-22T09:00:00Z',
          updated_at: '2026-06-22T09:00:00Z',
        },
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function fillRequiredForm(page) {
  await page.getByLabel('시즌명 *').fill('2027 정시 집중반');
  await page.getByLabel('시즌 타입').selectOption('regular');
  await page.getByLabel('비시즌 종강일').fill('2027-06-30');
  await page.getByLabel('시즌 시작일 *').fill('2027-07-01');
  await page.getByLabel('시즌 종료일 *').fill('2027-12-15');
  await page.getByLabel('기본 시즌비 (원)').fill('1500000');
  await page.getByLabel('할인 타입').selectOption('rate');
  await page.getByLabel('할인율 (%)').fill('20');
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/new', { waitUntil: 'networkidle' });
  await page.getByTestId('season-create-workspace').waitFor();
  await page.getByRole('heading', { name: '시즌 등록' }).waitFor();
  await assertNoRawVisibleText(page, 'season create desktop');
  await assertNoHorizontalOverflow(page, 'season create desktop');
  await page.screenshot({ path: '/Users/etlab/paca-season-create-desktop.png', fullPage: true });

  await fillRequiredForm(page);
  await page.getByRole('button', { name: '화' }).click();
  await page.getByRole('button', { name: '토' }).click();
  await page.getByText('고3').locator('..').getByRole('button', { name: '오후' }).click();
  await page.getByText('N수').locator('..').getByRole('button', { name: '오전' }).click();
  await page.getByRole('button', { name: '등록' }).click();
  await page.waitForURL('**/seasons');

  const payload = state.createPayloads.at(-1);
  if (!payload) throw new Error('season create endpoint not called');
  if (payload.season_name !== '2027 정시 집중반') throw new Error(`unexpected name: ${JSON.stringify(payload)}`);
  if (payload.season_type !== 'regular') throw new Error(`unexpected type: ${JSON.stringify(payload)}`);
  if (payload.season_start_date !== '2027-07-01') throw new Error(`unexpected start: ${JSON.stringify(payload)}`);
  if (payload.season_end_date !== '2027-12-15') throw new Error(`unexpected end: ${JSON.stringify(payload)}`);
  if (payload.non_season_end_date !== '2027-06-30') throw new Error(`unexpected non season: ${JSON.stringify(payload)}`);
  if (payload.default_season_fee !== 1500000) throw new Error(`unexpected fee: ${JSON.stringify(payload)}`);
  if (payload.allows_continuous !== true) throw new Error(`unexpected continuous flag: ${JSON.stringify(payload)}`);
  if (payload.continuous_to_season_type !== 'regular') throw new Error(`unexpected continuous target: ${JSON.stringify(payload)}`);
  if (payload.continuous_discount_type !== 'rate') throw new Error(`unexpected discount type: ${JSON.stringify(payload)}`);
  if (payload.continuous_discount_rate !== 20) throw new Error(`unexpected discount rate: ${JSON.stringify(payload)}`);
  if (payload.operating_days.includes(2) || payload.operating_days.includes(6)) {
    throw new Error(`operating day toggles failed: ${JSON.stringify(payload)}`);
  }
  if (!payload.grade_time_slots['고3'].includes('afternoon')) {
    throw new Error(`grade slot toggle failed: ${JSON.stringify(payload)}`);
  }
  if (payload.grade_time_slots['N수'].includes('morning')) {
    throw new Error(`grade slot toggle failed: ${JSON.stringify(payload)}`);
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

  await page.goto('/seasons/new', { waitUntil: 'networkidle' });
  await page.getByTestId('season-create-workspace').waitFor();
  await assertNoRawVisibleText(page, 'season create mobile');
  await assertNoHorizontalOverflow(page, 'season create mobile');
  await page.screenshot({ path: '/Users/etlab/paca-season-create-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runCreateError(browser) {
  const state = makeState({ failCreate: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/new', { waitUntil: 'networkidle' });
  await page.getByTestId('season-create-workspace').waitFor();
  await fillRequiredForm(page);
  await page.getByRole('button', { name: '등록' }).click();
  await page.getByText('시즌을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'season create error');
  await assertNoHorizontalOverflow(page, 'season create error');
  await page.screenshot({ path: '/Users/etlab/paca-season-create-error-mobile.png', fullPage: true });

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
    const createError = await runCreateError(browser);
    [normal, mobile, createError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      createPayload: normal.state.createPayloads.at(-1),
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      mobileConsoleErrors: mobile.diagnostics.consoleErrors,
      createErrorConsoleErrors: createError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
