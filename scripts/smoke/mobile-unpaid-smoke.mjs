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

function makePayments() {
  return [
    {
      id: 701,
      student_id: 101,
      student_name: '김민서',
      student_number: 'S-101',
      year_month: '2026-06',
      payment_type: 'monthly',
      base_amount: 600000,
      discount_amount: 0,
      additional_amount: 0,
      final_amount: 600000,
      paid_amount: 100000,
      due_date: '2026-06-10',
      payment_status: 'partial',
      phone: '010-1111-2222',
      parent_phone: '010-3333-4444',
      days_overdue: 12,
      created_at: '2026-06-01T00:00:00Z',
    },
    {
      id: 702,
      student_id: 102,
      student_name: '박서윤',
      student_number: 'S-102',
      year_month: '2026-05',
      payment_type: 'monthly',
      base_amount: 560000,
      discount_amount: 60000,
      additional_amount: 0,
      final_amount: 500000,
      paid_amount: 0,
      due_date: '2026-05-10',
      payment_status: 'pending',
      phone: null,
      parent_phone: '010-5555-6666',
      days_overdue: 31,
      created_at: '2026-05-01T00:00:00Z',
    },
  ];
}

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], paidIds: new Set(), payPayloads: [], ...overrides };
}

function unpaidTodayResponse(state) {
  const payments = makePayments().filter((payment) => !state.paidIds.has(payment.id));
  return {
    message: `오늘 미납자 ${payments.length}명`,
    date: toLocalDateStr(new Date()),
    day_of_week: new Date().getDay(),
    day_name: '월',
    count: payments.length,
    payments,
  };
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

    if (state.failLoad && method === 'GET' && path === '/payments/unpaid-today') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'GET' && path === '/payments/unpaid-today') {
      return jsonRoute(route, unpaidTodayResponse(state));
    }
    if (state.failPay && method === 'POST' && path === '/payments/701/pay') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'POST' && path === '/payments/701/pay') {
      state.payPayloads.push(request.postDataJSON());
      state.paidIds.add(701);
      return jsonRoute(route, { message: 'paid', payment: { id: 701, payment_status: 'paid' } });
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
    await page.goto('/m/unpaid', { waitUntil: 'domcontentloaded' });
    try {
      await page.getByTestId('mobile-unpaid-workspace').waitFor({ timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return;
    } catch (error) {
      if (attempt === 2) {
        const body = await page.locator('body').innerText().catch(() => '');
        throw new Error(`mobile unpaid workspace did not render at ${page.url()}: ${body.slice(0, 500)}\n${error.message}`);
      }
      await page.waitForTimeout(500);
    }
  }
}

async function runNormal(browser) {
  const state = makeState();
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  const workspace = page.getByTestId('mobile-unpaid-workspace');
  await workspace.getByRole('heading', { name: '오늘 출석 미납자' }).waitFor();
  await workspace.getByLabel('미납 학생 검색').fill('박서윤');
  await workspace.getByTestId('mobile-unpaid-card').filter({ hasText: '박서윤' }).waitFor();
  await workspace.getByTestId('mobile-unpaid-card').filter({ hasText: '김민서' }).waitFor({ state: 'detached' });
  await workspace.getByLabel('미납 학생 검색').fill('');
  await workspace.getByRole('link', { name: '김민서 보호자 전화' }).waitFor();
  await workspace.getByTestId('mobile-unpaid-card').filter({ hasText: '김민서' }).getByRole('button', { name: '완납 처리' }).click();
  await page.getByTestId('mobile-unpaid-pay-sheet').waitFor();
  await page.getByRole('button', { name: '계좌' }).click();
  await page.getByRole('button', { name: '완납 저장' }).click();
  await page.getByText('김민서 완납 처리되었습니다.').waitFor();
  await workspace.getByTestId('mobile-unpaid-card').filter({ hasText: '김민서' }).waitFor({ state: 'detached' });

  const payload = state.payPayloads.at(-1);
  if (payload?.paid_amount !== 500000) throw new Error(`paid amount mismatch: ${JSON.stringify(payload)}`);
  if (payload?.payment_method !== 'account') throw new Error(`payment method mismatch: ${JSON.stringify(payload)}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload?.payment_date || '')) throw new Error(`payment date mismatch: ${JSON.stringify(payload)}`);

  await assertNoRawVisibleText(page, 'mobile unpaid normal');
  await assertNoHorizontalOverflow(page, 'mobile unpaid normal');
  await page.screenshot({ path: '/Users/etlab/paca-mobile-unpaid.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await page.getByText('오늘 미납 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile unpaid load error');
  await assertNoHorizontalOverflow(page, 'mobile unpaid load error');
  await page.screenshot({ path: '/Users/etlab/paca-mobile-unpaid-load-error.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runPayError(browser) {
  const state = makeState({ failPay: true });
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  const workspace = page.getByTestId('mobile-unpaid-workspace');
  await workspace.getByTestId('mobile-unpaid-card').filter({ hasText: '김민서' }).getByRole('button', { name: '완납 처리' }).click();
  await page.getByRole('button', { name: '완납 저장' }).click();
  await page.getByText('납부 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile unpaid pay error');
  await assertNoHorizontalOverflow(page, 'mobile unpaid pay error');
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
    const payError = await runPayError(browser);
    [normal, loadError, payError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      payPayloads: normal.state.payPayloads,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
      payErrorConsoleErrors: payError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
