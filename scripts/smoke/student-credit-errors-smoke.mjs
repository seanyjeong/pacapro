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

function makeStudent() {
  return {
    id: 41,
    academy_id: 1,
    student_number: 'S-2026-041',
    name: '김진우',
    gender: 'male',
    student_type: 'regular',
    phone: '010-1111-2222',
    parent_phone: '010-3333-4444',
    school: '일산고',
    grade: '고2',
    class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
    weekly_count: 2,
    monthly_tuition: '520000',
    discount_rate: '0',
    discount_reason: null,
    payment_due_day: 5,
    final_monthly_tuition: '520000',
    is_season_registered: false,
    current_season_id: null,
    status: 'active',
    rest_start_date: null,
    rest_end_date: null,
    rest_reason: null,
    enrollment_date: '2026-03-04',
    notes: '학생 상세 크레딧 오류 테스트',
    is_trial: false,
    trial_remaining: null,
    trial_dates: null,
    time_slot: 'evening',
    academy_name: 'PACA 일산',
    created_at: '2026-02-20T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
  };
}

function makePayment() {
  return {
    id: 501,
    student_id: 41,
    student_name: '김진우',
    year_month: '2026-06',
    base_amount: '520000',
    discount_amount: '0',
    final_amount: '520000',
    paid_amount: '0',
    payment_status: 'pending',
    payment_method: null,
    paid_date: null,
    due_date: '2026-06-05',
    notes: null,
    created_at: '2026-06-01T09:00:00.000Z',
  };
}

function makeState() {
  return { createCreditPayload: null, hits: [] };
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

    if (method === 'GET' && path === '/students/41') {
      return jsonRoute(route, {
        message: 'ok',
        payments: [makePayment()],
        performances: [],
        student: makeStudent(),
      });
    }
    if (method === 'GET' && path === '/students/41/rest-credits') {
      return jsonRoute(route, { credits: [], message: 'ok', pendingTotal: 0 });
    }
    if (method === 'POST' && path === '/students/41/manual-credit') {
      state.createCreditPayload = request.postDataJSON();
      return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createPage(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { context, diagnostics: createDiagnostics(page), page, state };
}

async function runCreateError(browser) {
  const result = await createPage(browser);
  const { context, page, state } = result;

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByText('2026-06', { exact: true }).waitFor();
  await page.getByRole('button', { name: '크레딧 추가' }).click();
  await page.getByRole('heading', { name: '크레딧 관리' }).waitFor();
  await page.locator('#startDate').fill('2026-06-22');
  await page.locator('#endDate').fill('2026-06-24');
  await page.getByRole('button', { name: '병결' }).click();
  await page.getByRole('button', { name: '130,000원 크레딧 생성' }).click();
  await page.getByRole('alert').getByText('크레딧 생성 중 오류가 발생했습니다.').waitFor();

  if (await page.getByText('요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.').count()) {
    throw new Error('manual credit create error should stay inline without a duplicate global toast');
  }
  if (state.createCreditPayload?.reason !== '병결') {
    throw new Error(`unexpected manual credit payload: ${JSON.stringify(state.createCreditPayload)}`);
  }

  await assertNoRawVisibleText(page, 'student manual credit create error');
  await assertNoHorizontalOverflow(page, 'student manual credit create error');
  await page.screenshot({ path: '/Users/etlab/paca-student-credit-create-error.png', fullPage: true });
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
    const createError = await runCreateError(browser);
    assertDiagnostics(createError);
    console.log(JSON.stringify({
      createCreditPayload: createError.state.createCreditPayload,
      hits: createError.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
