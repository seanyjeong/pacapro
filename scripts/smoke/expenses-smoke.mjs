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

function makeExpenses() {
  return [
    {
      id: 901,
      expense_date: '2026-06-03',
      category: 'rent',
      amount: 1800000,
      description: '강남 지점 월세',
      payment_method: 'account',
      notes: '6월 임대료',
    },
    {
      id: 902,
      expense_date: '2026-06-10',
      category: '환불(대기)',
      amount: 240000,
      description: '박민수 휴원 환불 대기',
      payment_method: 'cash',
      notes: '보호자 확인 필요',
    },
    {
      id: 903,
      expense_date: '2026-06-21',
      category: 'salary',
      amount: 947660,
      instructor_id: 12,
      instructor_name: '이코치',
      salary_id: 202,
      description: '5월 강사 급여',
      payment_method: 'account',
      notes: '',
    },
  ];
}

function makeState(overrides = {}) {
  return { expenses: makeExpenses(), hits: [], externalContinues: [], ...overrides };
}

async function warmExpensesRoute() {
  const response = await fetch(`${BASE_URL}/expenses`);
  if (!response.ok) throw new Error(`expenses route warmup failed: ${response.status}`);
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

    if (state.failExpenses && method === 'GET' && path === '/expenses') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/expenses') {
      return jsonRoute(route, { message: 'ok', expenses: state.expenses });
    }
    if (method === 'POST' && path === '/expenses/902/complete-refund') {
      state.refundPayload = request.postDataJSON();
      state.expenses = state.expenses.filter((expense) => expense.id !== 902);
      return jsonRoute(route, { message: 'refund completed' });
    }
    if (method === 'DELETE' && path === '/expenses/901') {
      state.deletedExpenseId = 901;
      state.expenses = state.expenses.filter((expense) => expense.id !== 901);
      return jsonRoute(route, { message: 'deleted' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function openExpensesPage(page) {
  await page.goto('/expenses', { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: '지출 관리' }).waitFor({ timeout: 10000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '지출 관리' }).waitFor();
  }
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  let nativeDialogMessage = null;
  page.on('dialog', async (dialog) => {
    nativeDialogMessage = dialog.message();
    await dialog.dismiss();
  });

  await openExpensesPage(page);
  await page.getByText('Finance Desk').waitFor();
  await page.locator('tr:has-text("강남 지점 월세")').waitFor();
  await page.locator('tr:has-text("박민수 휴원 환불 대기")').waitFor();
  const salaryRow = page.locator('tr:has-text("5월 강사 급여")');
  await salaryRow.getByRole('button', { name: '5월 강사 급여 지출 상세 보기' }).waitFor();
  const salaryLink = salaryRow.getByRole('link', { name: '5월 강사 급여 급여 명세서 보기' });
  await salaryLink.waitFor();
  if ((await salaryLink.getAttribute('href')) !== '/salaries/202') {
    throw new Error('missing salary detail link for salary expense row');
  }
  const instructorLink = salaryRow.getByRole('link', { name: '이코치 강사 상세 보기' });
  await instructorLink.waitFor();
  if ((await instructorLink.getAttribute('href')) !== '/instructors/12') {
    throw new Error('missing instructor detail link for salary expense row');
  }
  await salaryRow.getByRole('button', { name: '5월 강사 급여 지출 상세 보기' }).click();
  await page.getByText('관련 작업').waitFor();
  await page.getByRole('link', { name: '5월 강사 급여 급여 명세서 보기' }).last().waitFor();
  await page.getByRole('button', { name: '닫기' }).click();
  await assertNoRawVisibleText(page, 'expenses desktop');
  await assertNoHorizontalOverflow(page, 'expenses desktop');
  await page.screenshot({ path: '/Users/etlab/paca-expenses-desktop.png', fullPage: true });

  await page.getByLabel('지출 검색').fill('월세');
  await page.locator('tr:has-text("강남 지점 월세")').waitFor();
  await page.locator('tr:has-text("박민수 휴원 환불 대기")').waitFor({ state: 'hidden' });
  await page.getByLabel('지출 검색').fill('');
  await page.locator('tr:has-text("박민수 휴원 환불 대기")').waitFor();

  await page.locator('tr:has-text("박민수 휴원 환불 대기")').getByRole('button', { name: '환불 완료' }).click();
  await page.getByRole('alertdialog').getByRole('heading', { name: '환불 완료 처리' }).waitFor();
  await page.getByRole('alertdialog').getByRole('button', { name: '완료 처리' }).click();
  await page.getByText('환불이 완료 처리되었습니다.').waitFor();
  if (state.refundPayload?.payment_method !== 'cash') throw new Error(`unexpected refund payload ${JSON.stringify(state.refundPayload)}`);

  await page.locator('tr:has-text("강남 지점 월세")').getByRole('button', { name: '지출 삭제' }).click();
  await page.getByRole('alertdialog').getByRole('heading', { name: '지출 삭제' }).waitFor();
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제' }).click();
  await page.getByText('삭제되었습니다.').waitFor();
  if (state.deletedExpenseId !== 901) throw new Error(`delete endpoint not called: ${state.deletedExpenseId}`);
  if (nativeDialogMessage) throw new Error(`unexpected native dialog: ${nativeDialogMessage}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('article:has-text("5월 강사 급여")').waitFor();
  const salaryCard = page.locator('article:has-text("5월 강사 급여")');
  await salaryCard.getByRole('button', { name: '5월 강사 급여 지출 상세 보기' }).waitFor();
  await salaryCard.getByRole('link', { name: '5월 강사 급여 급여 명세서 보기' }).waitFor();
  await salaryCard.getByRole('link', { name: '이코치 강사 상세 보기' }).waitFor();
  await assertNoRawVisibleText(page, 'expenses mobile');
  await assertNoHorizontalOverflow(page, 'expenses mobile');
  await page.screenshot({ path: '/Users/etlab/paca-expenses-mobile.png', fullPage: true });
  await page.locator('article:has-text("5월 강사 급여")').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/Users/etlab/paca-expenses-mobile-list.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runError(browser) {
  const state = makeState({ failExpenses: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openExpensesPage(page);
  await page.getByRole('alert').getByRole('heading', { name: '지출 내역을 불러오지 못했습니다' }).waitFor();
  await page.getByText('지출 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'expenses error');
  await assertNoHorizontalOverflow(page, 'expenses error');
  await page.screenshot({ path: '/Users/etlab/paca-expenses-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  await warmExpensesRoute();
  const browser = await launchSmokeBrowser();
  try {
    const normal = await runNormal(browser);
    const error = await runError(browser);
    [normal, error].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      refundPayload: normal.state.refundPayload,
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
