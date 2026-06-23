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
const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getFullYear();
const CURRENT_MONTH = CURRENT_DATE.getMonth() + 1;
const CURRENT_YEAR_MONTH = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}`;
const PREVIOUS_YEAR_MONTH = new Date(CURRENT_YEAR, CURRENT_MONTH - 2, 1);
const PREVIOUS_PAYMENT_MONTH = `${PREVIOUS_YEAR_MONTH.getFullYear()}-${String(PREVIOUS_YEAR_MONTH.getMonth() + 1).padStart(2, '0')}`;

function makePayments() {
  return [
    {
      id: 701,
      student_id: 41,
      student_name: '박민수',
      student_number: 'S-2026-041',
      year_month: CURRENT_YEAR_MONTH,
      payment_type: 'monthly',
      base_amount: 560000,
      discount_amount: 0,
      additional_amount: 0,
      final_amount: 560000,
      paid_amount: 0,
      due_date: `${CURRENT_YEAR_MONTH}-10`,
      payment_status: 'pending',
      description: `${CURRENT_MONTH}월 수강료`,
      notes: '',
      created_at: `${CURRENT_YEAR_MONTH}-01T09:00:00Z`,
      credit_balance: 120000,
    },
    {
      id: 702,
      student_id: 42,
      student_name: '이서연',
      student_number: 'S-2026-042',
      year_month: CURRENT_YEAR_MONTH,
      payment_type: 'monthly',
      base_amount: 520000,
      discount_amount: 20000,
      additional_amount: 0,
      final_amount: 500000,
      paid_amount: 500000,
      paid_date: `${CURRENT_YEAR_MONTH}-05`,
      due_date: `${CURRENT_YEAR_MONTH}-10`,
      payment_status: 'paid',
      payment_method: 'card',
      description: `${CURRENT_MONTH}월 수강료`,
      notes: '',
      created_at: `${CURRENT_YEAR_MONTH}-01T09:00:00Z`,
    },
    {
      id: 703,
      student_id: 43,
      student_name: '한서준',
      student_number: 'S-2026-043',
      year_month: PREVIOUS_PAYMENT_MONTH,
      payment_type: 'season',
      base_amount: 600000,
      discount_amount: 0,
      additional_amount: 0,
      final_amount: 600000,
      paid_amount: 200000,
      due_date: '2026-05-10',
      payment_status: 'partial',
      payment_method: 'account',
      description: '5월 시즌비',
      notes: '분납 예정',
      created_at: '2026-05-01T09:00:00Z',
    },
  ];
}

function makeClassDays() {
  return {
    message: 'ok',
    students: [
      { id: 41, name: '박민수', grade: '고3', class_days: [1, 3], weekly_count: 2, time_slot: 'evening', class_days_next: null, class_days_effective_from: null },
      { id: 42, name: '이서연', grade: '고2', class_days: [2, 4], weekly_count: 2, time_slot: 'evening', class_days_next: null, class_days_effective_from: null },
      { id: 43, name: '한서준', grade: 'N수', class_days: [1, 5], weekly_count: 2, time_slot: 'afternoon', class_days_next: null, class_days_effective_from: null },
    ],
  };
}

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], payments: makePayments(), payPayload: null, ...overrides };
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

    if (state.failPayments && method === 'GET' && path === '/payments') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, {
        message: 'ok',
        settings: {
          exam_tuition: { 2: 560000 },
          adult_tuition: { 2: 420000 },
        },
      });
    }
    if (method === 'GET' && path === '/payments') return jsonRoute(route, { message: 'ok', payments: state.payments });
    if (method === 'GET' && path === '/students/class-days') return jsonRoute(route, makeClassDays());
    if (method === 'POST' && path === '/notifications/send-unpaid') {
      state.notificationPayload = request.postDataJSON();
      return jsonRoute(route, { sent: 1, failed: 0 });
    }
    if (method === 'POST' && path === '/payments/701/pay') {
      state.payPayload = request.postDataJSON();
      state.payments = state.payments.map((payment) =>
        payment.id === 701
          ? { ...payment, paid_amount: 560000, payment_status: 'paid', payment_method: state.payPayload.payment_method, paid_date: state.payPayload.payment_date }
          : payment
      );
      return jsonRoute(route, { message: 'paid', payment: state.payments.find((payment) => payment.id === 701) });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function waitForInitialRows(page) {
  const firstPaymentRow = page.locator('tr:has-text("박민수")');
  try {
    await firstPaymentRow.waitFor({ timeout: 20000 });
  } catch {
    await page.reload({ waitUntil: 'networkidle' });
    await firstPaymentRow.waitFor({ timeout: 20000 });
  }
  await page.locator('tr:has-text("한서준")').waitFor();
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/payments', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '학원비 관리' }).waitFor();
  await waitForInitialRows(page);
  await assertOperationsBoard(page);
  await page.getByRole('button', { name: '일할계산기' }).click();
  await page.getByText('일할계산 계산기').waitFor();
  await page.getByRole('button', { name: '월', exact: true }).click();
  await page.getByRole('button', { name: '수', exact: true }).click();
  const tuitionInput = page.locator('input[type="number"]');
  await tuitionInput.waitFor();
  if ((await tuitionInput.inputValue()) !== '560000') {
    throw new Error(`proration calculator did not load weekly tuition: ${await tuitionInput.inputValue()}`);
  }
  await page.getByText(/560,000원/).waitFor();
  await page.getByRole('button', { name: '닫기' }).click();
  await assertNoRawVisibleText(page, 'payments desktop');
  await assertNoHorizontalOverflow(page, 'payments desktop');
  await page.screenshot({ path: '/Users/etlab/paca-payments-desktop.png', fullPage: true });

  await page.getByLabel('학생 이름 검색').fill('이서연');
  await page.locator('tr:has-text("이서연")').waitFor();
  await page.locator('tr:has-text("박민수")').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await page.locator('tr:has-text("박민수")').waitFor();

  const board = page.getByTestId('payments-operations-board');
  await board.getByRole('button', { name: '미납 1건' }).click();
  await page.locator('tr:has-text("박민수")').waitFor();
  await page.locator('tr:has-text("이서연")').waitFor({ state: 'hidden' });
  if (!state.hits.some((hit) => hit.includes('/payments?') && hit.includes('payment_status=pending'))) {
    throw new Error(`missing pending metric query: ${state.hits.join(' | ')}`);
  }
  await board.getByRole('button', { name: '총 청구 1건' }).click();
  await page.locator('tr:has-text("이서연")').waitFor();
  await page.locator('tr:has-text("한서준")').waitFor();

  await page.getByRole('button', { name: '미납 알림 (1명)' }).click();
  await page.getByRole('alertdialog').getByText('미납자 1명에게 알림톡을 발송할까요?').waitFor();
  await page.getByRole('alertdialog').getByRole('button', { name: '발송' }).click();
  await page.getByText('알림 발송 완료: 1명 성공, 0명 실패').waitFor();
  if (state.notificationPayload?.year !== CURRENT_YEAR) throw new Error(`unexpected notification payload ${JSON.stringify(state.notificationPayload)}`);
  if (state.notificationPayload?.month !== CURRENT_MONTH) throw new Error(`unexpected notification payload ${JSON.stringify(state.notificationPayload)}`);

  await page.locator('tr:has-text("한서준")').getByRole('button', { name: '계좌' }).click();
  await page.getByRole('alertdialog').getByText(/400,000/).waitFor();
  if (await page.getByRole('alertdialog').getByText(/600,000/).count()) {
    throw new Error('partial payment dialog showed full amount instead of remaining amount');
  }
  await page.getByRole('alertdialog').getByRole('button', { name: '취소' }).click();

  await page.locator('tr:has-text("박민수")').getByRole('button', { name: '계좌' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '납부 처리' }).click();
  await page.getByText('박민수님의 학원비가 납부 처리되었습니다.').waitFor();
  if (state.payPayload?.paid_amount !== 560000) throw new Error(`unexpected pay amount ${JSON.stringify(state.payPayload)}`);
  if (state.payPayload?.payment_method !== 'account') throw new Error(`unexpected pay method ${JSON.stringify(state.payPayload)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '학원비 관리' }).waitFor();
  await assertOperationsBoard(page, { paidRate: '67%', unpaid: '0건', unpaidAction: '미납 알림 발송 (0명)' });
  await page.locator('article:has-text("박민수")').waitFor();
  await assertNoRawVisibleText(page, 'payments mobile');
  await assertNoHorizontalOverflow(page, 'payments mobile');
  await page.screenshot({ path: '/Users/etlab/paca-payments-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function assertOperationsBoard(page, options = {}) {
  const expected = {
    paidRate: '33%',
    total: '3건',
    unpaid: '1건',
    previous: '1건',
    unpaidAction: '미납 알림 발송 (1명)',
    ...options,
  };
  const board = page.getByTestId('payments-operations-board');
  await board.getByRole('heading', { name: '수납 작업 보드' }).waitFor();
  await board.getByTestId('payments-metric-total').getByText(expected.total).waitFor();
  await board.getByTestId('payments-metric-unpaid').getByText(expected.unpaid).waitFor();
  await board.getByTestId('payments-metric-previous').getByText(expected.previous).waitFor();
  await board.getByTestId('payments-metric-rate').getByText(expected.paidRate).waitFor();
  await board.getByRole('button', { name: '일할계산 열기' }).waitFor();
  await board.getByRole('button', { name: expected.unpaidAction }).waitFor();
  await board.getByRole('button', { name: '신규 학원비 청구' }).waitFor();
}

async function runError(browser) {
  const state = makeState({ failPayments: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/payments', { waitUntil: 'networkidle' });
  await page.getByText('학원비 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'payments error');
  await assertNoHorizontalOverflow(page, 'payments error');
  await page.screenshot({ path: '/Users/etlab/paca-payments-error-mobile.png', fullPage: true });

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
    const error = await runError(browser);
    [normal, error].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      payPayload: normal.state.payPayload,
      notificationPayload: normal.state.notificationPayload,
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
