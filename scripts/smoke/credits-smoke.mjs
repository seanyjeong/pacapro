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

function makeCredits() {
  return [
    {
      id: 801,
      student_id: 41,
      student_name: '박민수',
      student_status: 'paused',
      academy_id: 1,
      source_payment_id: 701,
      rest_start_date: '2026-06-03',
      rest_end_date: '2026-06-12',
      rest_days: 10,
      credit_amount: 180000,
      remaining_amount: 120000,
      credit_type: 'carryover',
      status: 'partial',
      applied_to_payment_id: null,
      created_at: '2026-06-12T09:00:00Z',
      processed_at: null,
      notes: '휴원 기간 이월',
    },
    {
      id: 802,
      student_id: 42,
      student_name: '이서연',
      student_status: 'active',
      academy_id: 1,
      source_payment_id: null,
      rest_start_date: '',
      rest_end_date: '',
      rest_days: 0,
      credit_amount: 50000,
      remaining_amount: 50000,
      credit_type: 'manual',
      status: 'pending',
      applied_to_payment_id: null,
      created_at: '2026-06-15T09:00:00Z',
      processed_at: null,
      notes: '수동 조정',
    },
  ];
}

const stats = {
  total_count: 2,
  total_credit: 230000,
  total_remaining: 170000,
  pending_count: 1,
  pending_amount: 50000,
  partial_count: 1,
  applied_count: 0,
};

const summary = {
  students_with_credit: [
    { id: 41, name: '박민수', student_status: 'paused', total_remaining: 120000, credit_count: 1 },
    { id: 42, name: '이서연', student_status: 'active', total_remaining: 50000, credit_count: 1 },
  ],
  type_stats: [
    { credit_type: 'carryover', count: 1, total_amount: 180000, remaining_amount: 120000 },
    { credit_type: 'manual', count: 1, total_amount: 50000, remaining_amount: 50000 },
  ],
};

function makeState(overrides = {}) {
  return { credits: makeCredits(), externalContinues: [], hits: [], ...overrides };
}

async function warmCreditsRoute() {
  const response = await fetch(`${BASE_URL}/payments/credits`);
  if (!response.ok) throw new Error(`credits route warmup failed: ${response.status}`);
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
    state.hits.push(`${method} ${path}${url.search}`);

    if (state.failCredits && method === 'GET' && path === '/payments/credits') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/payments/credits') return jsonRoute(route, { credits: state.credits, stats });
    if (method === 'GET' && path === '/payments/credits/summary') return jsonRoute(route, summary);

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function openCreditsPage(page) {
  await page.goto('/payments/credits', { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: '크레딧 관리' }).waitFor({ timeout: 10000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '크레딧 관리' }).waitFor();
  }
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openCreditsPage(page);
  await page.locator('tr:has-text("박민수")').waitFor();
  await page.getByText('230,000원').first().waitFor();
  await assertOperationsBoard(page);
  await assertNoRawVisibleText(page, 'credits desktop');
  await assertNoHorizontalOverflow(page, 'credits desktop');
  await page.screenshot({ path: '/Users/etlab/paca-credits-desktop.png', fullPage: true });

  await page.getByRole('button', { name: '상태 필터' }).click();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/payments/credits?status=pending')),
    page.getByLabel('크레딧 필터').getByText('대기').click(),
  ]);
  if (!state.hits.some((hit) => hit.includes('/payments/credits?status=pending'))) {
    throw new Error(`missing status filter request: ${state.hits.join(' | ')}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertOperationsBoard(page);
  await page.locator('article:has-text("박민수")').waitFor();
  await assertNoRawVisibleText(page, 'credits mobile');
  await assertNoHorizontalOverflow(page, 'credits mobile');
  await page.screenshot({ path: '/Users/etlab/paca-credits-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function assertOperationsBoard(page) {
  const board = page.getByTestId('credits-operations-board');
  await board.getByRole('heading', { name: '크레딧 작업 보드' }).waitFor();
  await board.getByTestId('credits-metric-remaining').getByText('170,000원').waitFor();
  await board.getByTestId('credits-metric-pending').getByText('50,000원').waitFor();
  await board.getByTestId('credits-metric-students').getByText('2명').waitFor();
  await board.getByTestId('credits-metric-types').getByText('2개').waitFor();
  await board.getByRole('button', { name: '대기 크레딧 보기' }).waitFor();
  await board.getByRole('button', { name: '부분적용 보기' }).waitFor();
  await board.getByRole('button', { name: '전체 크레딧 보기' }).waitFor();
}

async function runError(browser) {
  const state = makeState({ failCredits: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openCreditsPage(page);
  await page.getByRole('alert').getByRole('heading', { name: '크레딧 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByRole('main').getByText('크레딧 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'credits error');
  await assertNoHorizontalOverflow(page, 'credits error');
  await page.screenshot({ path: '/Users/etlab/paca-credits-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
  const appConsoleErrors = result.diagnostics.consoleErrors.filter((message) =>
    message.includes('Credits page data load failed')
  );
  if (appConsoleErrors.length > 0) throw new Error(`unexpected app console errors: ${appConsoleErrors.join(' | ')}`);
}

async function main() {
  await warmCreditsRoute();
  const browser = await launchSmokeBrowser();
  try {
    const normal = await runNormal(browser);
    const error = await runError(browser);
    [normal, error].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      errorConsoleErrors: error.diagnostics.consoleErrors,
      normalExternalContinues: normal.state.externalContinues,
      errorExternalContinues: error.state.externalContinues,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
