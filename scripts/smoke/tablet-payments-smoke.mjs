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

const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getFullYear();
const CURRENT_MONTH = CURRENT_DATE.getMonth() + 1;
const CURRENT_YEAR_MONTH = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}`;

function makePayment(overrides = {}) {
  return {
    id: 801,
    student_id: 41,
    student_name: '김진우',
    student_number: 'S-2026-041',
    year_month: CURRENT_YEAR_MONTH,
    payment_type: 'monthly',
    base_amount: 520000,
    discount_amount: 52000,
    additional_amount: 0,
    final_amount: 468000,
    paid_amount: 0,
    due_date: `${CURRENT_YEAR_MONTH}-10`,
    payment_status: 'pending',
    description: `${CURRENT_MONTH}월 수강료`,
    notes: '',
    created_at: `${CURRENT_YEAR_MONTH}-01T09:00:00Z`,
    ...overrides,
  };
}

function makeState(overrides = {}) {
  return {
    hits: [],
    payPayload: null,
    payments: [
      makePayment(),
      makePayment({
        id: 802,
        student_id: 42,
        student_name: '박서연',
        student_number: 'S-2026-042',
        final_amount: 500000,
        paid_amount: 500000,
        payment_status: 'paid',
        payment_method: 'card',
        paid_date: `${CURRENT_YEAR_MONTH}-05`,
      }),
      makePayment({
        id: 803,
        student_id: 41,
        year_month: '2026-05',
        payment_type: 'season',
        base_amount: 600000,
        final_amount: 600000,
        paid_amount: 0,
        remaining_amount: 400000,
        payment_status: 'partial',
        payment_method: 'account',
        description: '5월 시즌비',
      }),
    ],
    ...overrides,
  };
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

    if (method === 'GET' && path === '/payments') {
      if (state.failPayments) {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      const studentId = Number(url.searchParams.get('student_id') || 0);
      const payments = studentId
        ? state.payments.filter((payment) => payment.student_id === studentId)
        : state.payments;
      return jsonRoute(route, { message: 'ok', payments });
    }

    if (method === 'POST' && path === '/payments/801/pay') {
      if (state.failPay) {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      state.payPayload = request.postDataJSON();
      state.payments = state.payments.map((payment) =>
        payment.id === 801
          ? {
              ...payment,
              paid_amount: 468000,
              payment_status: 'paid',
              payment_method: state.payPayload.payment_method,
              paid_date: state.payPayload.payment_date,
            }
          : payment
      );
      return jsonRoute(route, { message: 'paid', payment: state.payments.find((payment) => payment.id === 801) });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createPage(browser, state, viewport) {
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function runStudentFocused(browser) {
  const state = makeState();
  const result = await createPage(browser, state, { width: 1180, height: 820 });
  const { context, page } = result;

  await page.goto('/tablet/payments?studentId=41', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '김진우 결제 확인' }).waitFor();
  await page.getByText('학생 상세').waitFor();
  await page.getByRole('table').getByText(/468,000/).waitFor();
  await page.getByLabel('결제 요약').getByText('전달 미납').waitFor();
  await page.getByLabel('결제 요약').getByText('1건').first().waitFor();
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByText('박서연').waitFor({ state: 'hidden' });
  const partialRow = page.locator('tr:has-text("5월 시즌비")');
  await partialRow.getByText('남은 금액').waitFor();
  await partialRow.getByText(/400,000/).waitFor();
  await partialRow.getByRole('button', { name: '계좌' }).click();
  await page.getByRole('alertdialog').getByText(/400,000/).waitFor();
  if (await page.getByRole('alertdialog').getByText(/600,000/).count()) {
    throw new Error('tablet partial payment dialog showed full amount instead of remaining amount');
  }
  await page.getByRole('alertdialog').getByRole('button', { name: '취소' }).click();

  const paymentHit = state.hits.find((hit) => hit.startsWith('GET /payments'));
  if (!paymentHit?.includes('student_id=41')) {
    throw new Error(`student filter was not sent to payments API: ${JSON.stringify(state.hits)}`);
  }

  await page.locator('tr:has-text("김진우")').getByRole('button', { name: '계좌' }).first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: '납부 처리' }).click();
  await page.getByText('김진우님의 학원비가 납부 처리되었습니다.').waitFor();
  if (state.payPayload?.paid_amount !== 468000) {
    throw new Error(`unexpected pay payload: ${JSON.stringify(state.payPayload)}`);
  }
  if (state.payPayload?.payment_method !== 'account') {
    throw new Error(`unexpected payment method: ${JSON.stringify(state.payPayload)}`);
  }

  await assertNoRawVisibleText(page, 'tablet payments student focused');
  await assertNoHorizontalOverflow(page, 'tablet payments student focused');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-payments-landscape.png', fullPage: true });

  await context.close();
  return result;
}

async function runPortrait(browser) {
  const state = makeState();
  const result = await createPage(browser, state, { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/payments', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '결제 확인' }).waitFor();
  await page.locator('article:has-text("김진우")').first().waitFor();
  await page.locator('article:has-text("박서연")').first().waitFor();
  await assertNoRawVisibleText(page, 'tablet payments portrait');
  await assertNoHorizontalOverflow(page, 'tablet payments portrait');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-payments-portrait.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const state = makeState({ failPayments: true });
  const result = await createPage(browser, state, { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/payments', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '결제 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByText('잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'tablet payments load error');
  await assertNoHorizontalOverflow(page, 'tablet payments load error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-payments-load-error.png', fullPage: true });

  await context.close();
  return result;
}

async function runPayError(browser) {
  const state = makeState({ failPay: true });
  const result = await createPage(browser, state, { width: 1180, height: 820 });
  const { context, page } = result;

  await page.goto('/tablet/payments?studentId=41', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '김진우 결제 확인' }).waitFor();
  await page.locator('tr:has-text("김진우")').getByRole('button', { name: '계좌' }).first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: '납부 처리' }).click();
  await page.getByText('납부 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'tablet payments pay error');
  await assertNoHorizontalOverflow(page, 'tablet payments pay error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-payments-pay-error.png', fullPage: true });

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
    const studentFocused = await runStudentFocused(browser);
    const portrait = await runPortrait(browser);
    const loadError = await runLoadError(browser);
    const payError = await runPayError(browser);
    [studentFocused, portrait, loadError, payError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      studentFocusedHits: studentFocused.state.hits,
      payPayload: studentFocused.state.payPayload,
      portraitHits: portrait.state.hits,
      loadErrorHits: loadError.state.hits,
      payErrorHits: payError.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
