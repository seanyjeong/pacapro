import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createAuthedContext,
  createDiagnostics,
  jsonRoute,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
  statTile,
} from './paca-smoke-utils.mjs';

const BASE_URL = process.env.PACA_SMOKE_BASE_URL || 'http://localhost:3109';

const students = [
  { id: 1, name: '김서준', status: 'active', monthly_tuition: '600000' },
  { id: 2, name: '이하린', status: 'active', monthly_tuition: '500000' },
  { id: 3, name: '박민수', status: 'paused', monthly_tuition: '450000' },
  { id: 4, name: '최예린', status: 'graduated', monthly_tuition: '0' },
];

const billedPayments = [
  { id: 11, student_id: 1, final_amount: 600000, paid_amount: 600000, payment_status: 'paid' },
  { id: 12, student_id: 2, final_amount: 500000, paid_amount: 0, payment_status: 'pending' },
  { id: 13, student_id: 3, final_amount: 450000, paid_amount: 450000, payment_status: 'paid' },
];

const paidPayments = [
  { id: 11, student_id: 1, final_amount: 600000, paid_amount: 600000, payment_status: 'paid' },
  { id: 14, student_id: 2, final_amount: 250000, paid_amount: 250000, payment_status: 'paid' },
];

const expenses = [
  { id: 21, expense_date: '2026-06-03', category: 'rent', amount: 320000 },
  { id: 22, expense_date: '2026-06-12', category: 'supplies', amount: 80000 },
];

const incomes = [
  { id: 31, income_date: '2026-06-08', category: 'goods', amount: 120000 },
];

const instructors = [
  { id: 41, name: '강민호', status: 'active' },
  { id: 42, name: '정다은', status: 'retired' },
];

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

    if (state.failLoad && method === 'GET' && path === '/students') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }

    if (method === 'GET' && path === '/students') return jsonRoute(route, { students });
    if (method === 'GET' && path === '/instructors') return jsonRoute(route, { instructors });
    if (method === 'GET' && path === '/expenses') return jsonRoute(route, { expenses });
    if (method === 'GET' && path === '/incomes') return jsonRoute(route, { incomes });
    if (method === 'GET' && path === '/payments' && url.searchParams.has('paid_year')) {
      return jsonRoute(route, { payments: paidPayments });
    }
    if (method === 'GET' && path === '/payments') return jsonRoute(route, { payments: billedPayments });
    if (method === 'GET' && path.startsWith('/exports/')) {
      state.exportHits.push(`${path}${url.search}`);
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'content-disposition': "attachment; filename*=UTF-8''report.xlsx" },
        body: Buffer.from('xlsx'),
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

function makeState(overrides = {}) {
  return { externalContinues: [], exportHits: [], hits: [], ...overrides };
}

async function waitForState(predicate, label) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 3000) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function shiftYearMonth({ year, month }, offset) {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function paymentsQuery({ year, month }) {
  return `GET /payments?year=${year}&month=${month}`;
}

async function openReportsPage(page) {
  await page.goto('/reports', { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: '리포트', exact: true }).waitFor({ timeout: 10000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '리포트', exact: true }).waitFor();
  }
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openReportsPage(page);
  // 영어 소제목 'Finance Desk' 는 새 디자인에서 없앴다.
  await assertOperationsBoard(page);
  await page.getByText('970,000원').first().waitFor();
  await page.getByLabel('수입 분석').getByText('500,000원').waitFor();
  const unpaidLink = page.getByRole('link', { name: /미수납 관리 1건/ });
  await unpaidLink.waitFor();
  if ((await unpaidLink.getAttribute('href')) !== '/payments?payment_status=pending') {
    throw new Error('missing unpaid payments quick link');
  }
  const incomeLink = page.getByRole('link', { name: /수입 내역 기타 1건/ });
  await incomeLink.waitFor();
  if ((await incomeLink.getAttribute('href')) !== '/incomes') {
    throw new Error('missing incomes quick link');
  }
  const expensesLink = page.getByRole('link', { name: /지출 내역 2건/ });
  await expensesLink.waitFor();
  if ((await expensesLink.getAttribute('href')) !== '/expenses') {
    throw new Error('missing expenses quick link');
  }
  await assertNoRawVisibleText(page, 'reports desktop');
  await assertNoHorizontalOverflow(page, 'reports desktop');
  await page.screenshot({ path: '/Users/etlab/paca-reports-desktop.png', fullPage: true });

  // 월 이동 버튼은 보드 대신 화면 머리의 '리포트 월 이동' 묶음에 있다.
  const monthNav = page.getByRole('group', { name: '리포트 월 이동' });
  const initialMonth = currentYearMonth();
  const previousMonth = shiftYearMonth(initialMonth, -1);
  await monthNav.getByRole('button', { name: '이전 달' }).click();
  await waitForState(() => state.hits.includes(paymentsQuery(previousMonth)), 'previous month query');
  // 처음 불러오기 횟수는 개발 서버(StrictMode 두 번 실행)와 빌드 서버가 달라서, 누르기 전보다 한 번 더 불렀는지로 본다.
  const initialMonthHits = () => state.hits.filter((hit) => hit === paymentsQuery(initialMonth)).length;
  const beforeNext = initialMonthHits();
  await monthNav.getByRole('button', { name: '다음 달' }).click();
  await waitForState(() => initialMonthHits() > beforeNext, 'next month query');

  await page.locator('#report-month').fill('2026-05');
  await page.locator('#report-month').dispatchEvent('change');
  await page.waitForLoadState('networkidle');
  if (!state.hits.includes('GET /payments?year=2026&month=5')) {
    throw new Error(`month query not called: ${JSON.stringify(state.hits)}`);
  }

  await openExportMenu(page);
  await page.getByRole('button', { name: '수입 내역 다운로드' }).click();
  await waitForState(() => state.exportHits.some((hit) => hit.startsWith('/exports/revenue?')), 'revenue export');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '리포트', exact: true }).waitFor();
  await assertOperationsBoard(page);
  await page.getByRole('region', { name: '리포트 요약' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/Users/etlab/paca-reports-mobile-board.png', fullPage: false });
  await page.getByRole('link', { name: /미수납 관리 1건/ }).waitFor();
  // 재원생 수는 '학생 관리' 바로 가기 대신 위 요약 줄의 '재원생' 칸에 보인다.
  await page.getByRole('link', { name: /학생 관리/ }).waitFor();
  await statTile(page.getByRole('region', { name: '리포트 요약' }), '재원생').getByText('2명', { exact: true }).waitFor();
  await assertNoRawVisibleText(page, 'reports mobile');
  await assertNoHorizontalOverflow(page, 'reports mobile');
  await page.screenshot({ path: '/Users/etlab/paca-reports-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function assertOperationsBoard(page) {
  // 새 디자인: '리포트 작업 보드'를 나눴다. 순이익은 위 '리포트 요약' 줄, 수납률·미수납은 수입 분석 카드,
  // 바로가기는 '바로 가기' 카드, 다운로드는 머리의 '엑셀 다운로드' 메뉴로 옮겨졌다(같은 test id·이름).
  await page.getByRole('region', { name: '리포트 요약' }).waitFor();
  await page.getByTestId('reports-metric-net-profit').getByText('+570,000원').waitFor();
  await page.getByTestId('reports-metric-collection').getByText('55%').waitFor();
  await page.getByTestId('reports-metric-unpaid').getByText('500,000원').waitFor();
  await page.getByRole('navigation', { name: '리포트 빠른 이동' }).getByRole('link', { name: /미수납 관리 1건/ }).waitFor();
  await openExportMenu(page);
  await page.getByRole('button', { name: '수입 내역 다운로드' }).waitFor();
  await page.getByRole('button', { name: '연간 재무 리포트 다운로드' }).waitFor();
  // 메뉴 바깥 전체를 덮는 닫기 단추는 가운데가 메뉴에 가려 있어 클릭 이벤트로 닫는다.
  await page.getByRole('button', { name: '다운로드 메뉴 닫기' }).dispatchEvent('click');
  await page.getByRole('button', { name: '수입 내역 다운로드' }).waitFor({ state: 'hidden' });
}

async function openExportMenu(page) {
  await page.getByRole('button', { name: '엑셀 다운로드' }).click();
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/reports', { waitUntil: 'domcontentloaded' });
  await page.getByText('리포트 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'reports error');
  await assertNoHorizontalOverflow(page, 'reports error');
  await page.screenshot({ path: '/Users/etlab/paca-reports-error-mobile.png', fullPage: true });

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
      normalHits: normal.state.hits,
      exportHits: normal.state.exportHits,
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
