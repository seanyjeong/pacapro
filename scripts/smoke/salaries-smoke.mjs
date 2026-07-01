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

function makeSalaries() {
  return [
    {
      id: 201,
      instructor_id: 11,
      instructor_name: '김강사',
      year_month: '2026-05',
      base_amount: 1145000,
      incentive_amount: 30000,
      total_deduction: 10000,
      tax_type: 'insurance',
      tax_amount: 111250,
      insurance_details: {},
      net_salary: 1053750,
      payment_status: 'pending',
      payment_date: null,
      created_at: '2026-06-01T09:00:00Z',
      updated_at: '2026-06-02T09:00:00Z',
    },
    {
      id: 202,
      instructor_id: 12,
      instructor_name: '이코치',
      year_month: '2026-05',
      base_amount: 980000,
      incentive_amount: 0,
      total_deduction: 0,
      tax_type: '3.3%',
      tax_amount: 32340,
      insurance_details: {},
      net_salary: 947660,
      payment_status: 'paid',
      payment_date: '2026-06-10',
      created_at: '2026-06-01T09:00:00Z',
      updated_at: '2026-06-10T09:00:00Z',
    },
    {
      id: 203,
      instructor_id: 13,
      instructor_name: '박트레이너',
      year_month: '2026-05',
      base_amount: 760000,
      incentive_amount: 60000,
      total_deduction: 0,
      tax_type: 'none',
      tax_amount: 0,
      insurance_details: {},
      net_salary: 820000,
      payment_status: 'pending',
      payment_date: null,
      created_at: '2026-06-01T09:00:00Z',
      updated_at: '2026-06-02T09:00:00Z',
    },
  ];
}

function makeInstructors() {
  return [
    { id: 11, name: '김강사', status: 'active' },
    { id: 12, name: '이코치', status: 'active' },
    { id: 13, name: '박트레이너', status: 'active' },
  ];
}

function makeState(overrides = {}) {
  return { salaries: makeSalaries(), hits: [], externalContinues: [], ...overrides };
}

async function warmSalariesRoute() {
  const response = await fetch(`${BASE_URL}/salaries`);
  if (!response.ok) throw new Error(`salaries route warmup failed: ${response.status}`);
}

function filterSalaries(salaries, searchParams) {
  const status = searchParams.get('payment_status');
  const instructorId = Number(searchParams.get('instructor_id') || 0);
  return salaries.filter((salary) => {
    if (status && salary.payment_status !== status) return false;
    if (instructorId > 0 && salary.instructor_id !== instructorId) return false;
    return true;
  });
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
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, {
        settings: { academy_name: 'PACA 일산', salary_payment_day: 10, salary_month_type: 'next' },
      });
    }
    if (method === 'GET' && path === '/instructors') {
      return jsonRoute(route, { instructors: makeInstructors() });
    }
    if (state.failSalaries && method === 'GET' && path === '/salaries') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/salaries') {
      return jsonRoute(route, { message: 'ok', salaries: filterSalaries(state.salaries, url.searchParams) });
    }
    if (method === 'POST' && path === '/auth/verify-password') {
      state.verifyPayload = request.postDataJSON();
      return jsonRoute(route, { message: 'verified', verified: true });
    }
    if (method === 'POST' && path === '/salaries/bulk-pay') {
      state.bulkPayPayload = request.postDataJSON();
      state.salaries = state.salaries.map((salary) =>
        salary.payment_status === 'pending'
          ? { ...salary, payment_status: 'paid', payment_date: '2026-06-22' }
          : salary
      );
      return jsonRoute(route, { message: '급여 일괄 지급이 완료되었습니다.', paid_count: 2 });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function openSalariesPage(page) {
  await page.goto('/salaries', { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: '급여 관리' }).waitFor({ timeout: 10000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '급여 관리' }).waitFor();
  }
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openSalariesPage(page);
  await page.locator('header').getByText('Finance Desk').waitFor();
  await page.locator('article:has-text("김강사")').waitFor();
  await page.locator('article:has-text("박트레이너")').waitFor();
  await assertOperationsBoard(page);
  await page.getByRole('button', { name: '김강사 급여 명세서 보기' }).waitFor();
  const instructorLink = page.getByRole('link', { name: '김강사 강사 상세 보기' });
  await instructorLink.waitFor();
  if ((await instructorLink.getAttribute('href')) !== '/instructors/11') {
    throw new Error('missing instructor detail link for salary row');
  }
  await assertNoRawVisibleText(page, 'salaries desktop');
  await assertNoHorizontalOverflow(page, 'salaries desktop');
  await page.screenshot({ path: '/Users/etlab/paca-salaries-desktop.png', fullPage: true });

  const board = page.getByTestId('salaries-operations-board');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/salaries') && response.url().includes('payment_status=pending')),
    board.getByRole('button', { name: '지급 대기 2건' }).click(),
  ]);
  await page.locator('article:has-text("김강사")').waitFor();
  await page.locator('article:has-text("이코치")').waitFor({ state: 'hidden' });
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/salaries') && !response.url().includes('payment_status=')),
    board.getByRole('button', { name: '전체 2건' }).click(),
  ]);
  await page.locator('article:has-text("이코치")').waitFor();

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/salaries') && response.url().includes('month=4')),
    page.getByRole('button', { name: '이전 월' }).click(),
  ]);
  await page.getByLabel('조회 월').filter({ hasText: '2026년 4월' }).waitFor();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/salaries') && response.url().includes('month=5')),
    page.getByRole('button', { name: '다음 월' }).click(),
  ]);
  await page.getByLabel('조회 월').filter({ hasText: '2026년 5월' }).waitFor();

  await page.getByTestId('salaries-operations-board').getByRole('button', { name: /모두 지급처리 \(2건\)/ }).click();
  await page.getByLabel('비밀번호').fill('owner-pass');
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByText('급여 일괄 지급이 완료되었습니다.').waitFor();
  if (state.verifyPayload?.password !== 'owner-pass') throw new Error(`unexpected verify payload ${JSON.stringify(state.verifyPayload)}`);
  if (state.bulkPayPayload?.year_month !== '2026-05') throw new Error(`unexpected bulk payload ${JSON.stringify(state.bulkPayPayload)}`);

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/salaries') && response.url().includes('payment_status=paid')),
    page.getByLabel('지급 상태').selectOption('paid'),
  ]);
  if (!state.hits.some((hit) => hit.includes('/salaries') && hit.includes('payment_status=paid'))) {
    throw new Error(`missing paid status request: ${state.hits.join(' | ')}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertOperationsBoard(page, { paid: '3건', pending: '0건', unpaid: '0원', bulkAction: '모두 지급처리 (0건)' });
  await page.locator('article:has-text("김강사")').waitFor();
  await page.getByRole('button', { name: '김강사 급여 명세서 보기' }).waitFor();
  await page.getByRole('link', { name: '김강사 강사 상세 보기' }).waitFor();
  await assertNoRawVisibleText(page, 'salaries mobile');
  await assertNoHorizontalOverflow(page, 'salaries mobile');
  await page.screenshot({ path: '/Users/etlab/paca-salaries-mobile.png', fullPage: true });
  await page.locator('article:has-text("김강사")').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/Users/etlab/paca-salaries-mobile-list.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function assertOperationsBoard(page, options = {}) {
  const expected = {
    bulkAction: '모두 지급처리 (2건)',
    paid: '1건',
    pending: '2건',
    total: '3건',
    unpaid: '1,873,750원',
    ...options,
  };
  const board = page.getByTestId('salaries-operations-board');
  await board.getByRole('heading', { name: '급여 작업 보드' }).waitFor();
  await board.getByTestId('salaries-metric-total').getByText(expected.total).waitFor();
  await board.getByTestId('salaries-metric-pending').getByText(expected.pending).waitFor();
  await board.getByTestId('salaries-metric-unpaid').getByText(expected.unpaid).waitFor();
  await board.getByTestId('salaries-metric-paid').getByText(expected.paid).waitFor();
  await board.getByRole('button', { name: '지급 대기 보기' }).waitFor();
  await board.getByRole('button', { name: '지급 완료 보기' }).waitFor();
  await board.getByRole('button', { name: expected.bulkAction }).waitFor();
}

async function runError(browser) {
  const state = makeState({ failSalaries: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openSalariesPage(page);
  await page.getByRole('alert').getByRole('heading', { name: '급여 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByRole('main').getByText('급여 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'salaries error');
  await assertNoHorizontalOverflow(page, 'salaries error');
  await page.screenshot({ path: '/Users/etlab/paca-salaries-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  await warmSalariesRoute();
  const browser = await launchSmokeBrowser();
  try {
    const normal = await runNormal(browser);
    const error = await runError(browser);
    [normal, error].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      verifyPayload: normal.state.verifyPayload,
      bulkPayPayload: normal.state.bulkPayPayload,
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
