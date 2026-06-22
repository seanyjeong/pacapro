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

const students = [
  { id: 41, name: '박민수', student_number: 'S-2026-041', monthly_tuition: '560000', final_monthly_tuition: null, discount_rate: '10' },
  { id: 42, name: '이서연', student_number: 'S-2026-042', monthly_tuition: '520000', final_monthly_tuition: null, discount_rate: '0' },
];

function makePayment() {
  return {
    id: 401,
    student_id: 41,
    student_name: '박민수',
    student_number: 'S-2026-041',
    year_month: '2026-05',
    payment_type: 'monthly',
    base_amount: 560000,
    discount_amount: 40000,
    additional_amount: 0,
    final_amount: 520000,
    paid_amount: 0,
    paid_date: null,
    due_date: '2026-05-10',
    payment_status: 'pending',
    payment_method: null,
    description: '5월 수강료',
    notes: '수정 전 메모',
    created_at: '2026-05-01T09:00:00Z',
  };
}

function emptyPaymentStats() {
  return {
    message: 'ok',
    stats: { total_count: 0, paid_count: 0, partial_count: 0, unpaid_count: 0, total_expected: 0, total_collected: 0, total_outstanding: 0 },
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

    if (state.failStudents && method === 'GET' && path === '/students') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/students') return jsonRoute(route, { message: 'ok', students });
    if (state.failPayment && method === 'GET' && path === '/payments/401') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/payments/401') return jsonRoute(route, { message: 'ok', payment: state.payment });
    if (method === 'POST' && path === '/payments') {
      state.createPayload = request.postDataJSON();
      return jsonRoute(route, { message: 'created', payment: { ...state.createPayload, id: 501, student_name: '박민수' } });
    }
    if (method === 'PUT' && path === '/payments/401') {
      state.updatePayload = request.postDataJSON();
      state.payment = { ...state.payment, ...state.updatePayload };
      return jsonRoute(route, { message: 'updated', payment: state.payment });
    }
    if (method === 'GET' && path === '/payments/stats/summary') return jsonRoute(route, emptyPaymentStats());
    if (method === 'GET' && path === '/payments') return jsonRoute(route, { message: 'ok', payments: [] });

    return jsonRoute(route, { message: 'mocked' });
  });
}

function makeState(overrides = {}) {
  return { payment: makePayment(), hits: [], externalContinues: [], ...overrides };
}

async function runCreate(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/payments/new', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '학원비 청구' }).waitFor();
  await page.getByLabel('학생').selectOption('41');
  await page.getByLabel('청구 월').fill('2026-07');
  await page.getByLabel('납부 기한').fill('2026-07-10');
  await page.getByLabel('설명').fill('7월 수강료');
  await page.getByText('504,000원').waitFor();
  await assertNoRawVisibleText(page, 'payment create');
  await assertNoHorizontalOverflow(page, 'payment create');
  await page.screenshot({ path: '/Users/etlab/paca-payment-create-desktop.png', fullPage: true });

  await page.getByRole('button', { name: '등록' }).click();
  await page.waitForURL('**/payments');
  if (state.createPayload?.student_id !== 41) throw new Error(`unexpected create payload ${JSON.stringify(state.createPayload)}`);
  if (state.createPayload?.final_amount) throw new Error('create payload should not send derived final_amount');

  await context.close();
  return { state, diagnostics };
}

async function runEdit(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/payments/401/edit', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '학원비 수정' }).waitFor();
  if (!(await page.getByLabel('학생').isDisabled())) throw new Error('student selector should be locked in edit mode');
  await page.getByLabel('기본 금액').fill('580000');
  await page.getByLabel('내부 메모').fill('수정 후 메모');
  await assertNoRawVisibleText(page, 'payment edit');
  await assertNoHorizontalOverflow(page, 'payment edit');
  await page.screenshot({ path: '/Users/etlab/paca-payment-edit-mobile.png', fullPage: true });

  await page.getByRole('button', { name: '수정' }).click();
  await page.waitForURL('**/payments/401');
  if (state.updatePayload?.base_amount !== 580000) throw new Error(`unexpected update payload ${JSON.stringify(state.updatePayload)}`);
  if (state.updatePayload?.notes !== '수정 후 메모') throw new Error(`unexpected notes payload ${JSON.stringify(state.updatePayload)}`);

  await context.close();
  return { state, diagnostics };
}

async function runCreateError(browser) {
  const state = makeState({ failStudents: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/payments/new', { waitUntil: 'networkidle' });
  await page.getByText('학생 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'payment create error');
  await assertNoHorizontalOverflow(page, 'payment create error');
  await context.close();
  return { state, diagnostics };
}

async function runEditError(browser) {
  const state = makeState({ failPayment: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/payments/401/edit', { waitUntil: 'networkidle' });
  await page.getByText('학원비 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'payment edit error');
  await assertNoHorizontalOverflow(page, 'payment edit error');
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
    const create = await runCreate(browser);
    const edit = await runEdit(browser);
    const createError = await runCreateError(browser);
    const editError = await runEditError(browser);
    [create, edit, createError, editError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      createPayload: create.state.createPayload,
      updatePayload: edit.state.updatePayload,
      createHits: create.state.hits,
      editHits: edit.state.hits,
      createErrorConsoleErrors: createError.diagnostics.consoleErrors,
      editErrorConsoleErrors: editError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
