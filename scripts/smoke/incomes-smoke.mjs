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

function makePayments() {
  return [
    {
      id: 701,
      student_id: 41,
      student_name: '박민수',
      year_month: '2026-06',
      final_amount: 560000,
      paid_amount: 560000,
      paid_date: '2026-06-05',
      payment_method: 'card',
      payment_status: 'paid',
    },
    {
      id: 702,
      student_id: 42,
      student_name: '이서연',
      year_month: '2026-06',
      final_amount: 500000,
      paid_amount: 500000,
      paid_date: '2026-06-08',
      payment_method: 'account',
      payment_status: 'paid',
    },
  ];
}

function makeIncomes() {
  return [
    {
      id: 1001,
      income_date: '2026-06-09',
      category: 'other',
      amount: 180000,
      description: '체험 특강 수입',
      payment_method: 'card',
      notes: '토요일반',
    },
    {
      id: 1002,
      income_date: '2026-06-12',
      category: 'other',
      amount: 120000,
      description: '입시 설명회 참가비',
      payment_method: 'cash',
      notes: '',
    },
  ];
}

function makeState(overrides = {}) {
  return { payments: makePayments(), incomes: makeIncomes(), hits: [], externalContinues: [], ...overrides };
}

async function warmIncomesRoute() {
  const response = await fetch(`${BASE_URL}/incomes`);
  if (!response.ok) throw new Error(`incomes route warmup failed: ${response.status}`);
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

    if (state.failIncomes && method === 'GET' && path === '/incomes') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/incomes') {
      return jsonRoute(route, { message: 'ok', incomes: state.incomes });
    }
    if (method === 'GET' && path === '/payments') {
      return jsonRoute(route, { message: 'ok', payments: state.payments });
    }
    if (method === 'POST' && path === '/incomes') {
      const payload = JSON.parse(request.postData() || '{}');
      state.createdPayload = payload;
      state.incomes = [{ id: 1003, ...payload }, ...state.incomes];
      return jsonRoute(route, { message: 'created', income: { id: 1003, ...payload } });
    }
    if (method === 'DELETE' && path === '/incomes/1002') {
      state.deletedId = 1002;
      state.incomes = state.incomes.filter((income) => income.id !== 1002);
      return jsonRoute(route, { message: 'deleted' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function openIncomesPage(page) {
  await page.goto('/incomes', { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: '수입 관리' }).waitFor({ timeout: 10000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '수입 관리' }).waitFor();
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

  await openIncomesPage(page);
  await page.getByText('Finance Desk').waitFor();
  await page.locator('tr:has-text("박민수")').waitFor();
  await page.locator('tr:has-text("체험 특강 수입")').waitFor();
  const tuitionRow = page.locator('tr:has-text("박민수")');
  const paymentLink = tuitionRow.getByRole('link', { name: '박민수 결제 상세 보기' });
  await paymentLink.waitFor();
  if ((await paymentLink.getAttribute('href')) !== '/payments/701') {
    throw new Error('missing payment detail link for tuition income row');
  }
  const studentLink = tuitionRow.getByRole('link', { name: '박민수 학생 상세 보기' });
  await studentLink.waitFor();
  if ((await studentLink.getAttribute('href')) !== '/students/41') {
    throw new Error('missing student detail link for tuition income row');
  }
  await page.locator('tr:has-text("체험 특강 수입")').getByRole('button', { name: '체험 특강 수입 기타수입 상세 보기' }).waitFor();
  await assertNoRawVisibleText(page, 'incomes desktop');
  await assertNoHorizontalOverflow(page, 'incomes desktop');
  await page.screenshot({ path: '/Users/etlab/paca-incomes-desktop.png', fullPage: true });

  await page.getByRole('button', { name: '기타수입 등록' }).click();
  await page.getByLabel('날짜').fill('2026-06-18');
  await page.getByLabel('카테고리').selectOption('beverage');
  await page.getByLabel('금액').fill('45000');
  await page.getByLabel('설명', { exact: true }).fill('스포츠 음료 판매');
  await page.getByLabel('결제 방법').selectOption('transfer');
  await page.getByLabel('메모').fill('강남 저녁반');
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await page.getByText('수입이 등록되었습니다.').waitFor();
  if (state.createdPayload?.amount !== 45000) throw new Error(`unexpected created income ${JSON.stringify(state.createdPayload)}`);
  if (state.createdPayload?.category !== 'beverage') throw new Error(`unexpected category ${state.createdPayload?.category}`);

  await page.getByLabel('수입 검색').fill('이서연');
  await page.locator('tr:has-text("이서연")').waitFor();
  await page.locator('tr:has-text("박민수")').waitFor({ state: 'hidden' });
  await page.getByLabel('수입 검색').fill('');
  await page.locator('tr:has-text("입시 설명회 참가비")').getByRole('button', { name: '기타 수입 삭제' }).click();
  await page.getByRole('alertdialog').getByRole('heading', { name: '기타 수입 삭제' }).waitFor();
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제' }).click();
  await page.getByText('삭제되었습니다.').waitFor();
  if (state.deletedId !== 1002) throw new Error(`unexpected deleted income ${state.deletedId}`);
  if (nativeDialogMessage) throw new Error(`unexpected native dialog: ${nativeDialogMessage}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('article:has-text("박민수")').waitFor();
  await page.locator('article:has-text("체험 특강 수입")').waitFor();
  const tuitionCard = page.locator('article:has-text("박민수")');
  await tuitionCard.getByRole('link', { name: '박민수 결제 상세 보기' }).waitFor();
  await tuitionCard.getByRole('link', { name: '박민수 학생 상세 보기' }).waitFor();
  await page.locator('article:has-text("체험 특강 수입")').getByRole('button', { name: '체험 특강 수입 기타수입 상세 보기' }).waitFor();
  await assertNoRawVisibleText(page, 'incomes mobile');
  await assertNoHorizontalOverflow(page, 'incomes mobile');
  await page.screenshot({ path: '/Users/etlab/paca-incomes-mobile.png', fullPage: true });
  await page.locator('article:has-text("체험 특강 수입")').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/Users/etlab/paca-incomes-mobile-list.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runError(browser) {
  const state = makeState({ failIncomes: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openIncomesPage(page);
  await page.getByRole('alert').getByRole('heading', { name: '수입 내역을 불러오지 못했습니다' }).waitFor();
  await page.getByText('수입 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'incomes error');
  await assertNoHorizontalOverflow(page, 'incomes error');
  await page.screenshot({ path: '/Users/etlab/paca-incomes-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  await warmIncomesRoute();
  const browser = await launchSmokeBrowser();
  try {
    const normal = await runNormal(browser);
    const error = await runError(browser);
    [normal, error].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      createdPayload: normal.state.createdPayload,
      deletedId: normal.state.deletedId,
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
