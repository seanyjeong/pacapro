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
    student_type: 'exam',
    phone: '010-1111-2222',
    parent_phone: '010-3333-4444',
    school: '일산고',
    grade: '고2',
    admission_type: 'regular',
    class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
    weekly_count: 2,
    monthly_tuition: '520000',
    discount_rate: '10',
    discount_reason: '형제 할인',
    payment_due_day: 5,
    final_monthly_tuition: '468000',
    is_season_registered: true,
    current_season_id: 7,
    status: 'active',
    enrollment_date: '2026-03-04',
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
    discount_amount: '52000',
    final_amount: '468000',
    paid_amount: '0',
    payment_status: 'pending',
    payment_method: null,
    paid_date: null,
    due_date: '2026-06-05',
    notes: null,
    created_at: '2026-06-01T09:00:00.000Z',
  };
}

function makePreview() {
  return {
    student_name: '김진우',
    monthly_tuition: 520000,
    student_discount_rate: 10,
    prepaid_discount_rate: 5,
    months: [
      {
        year_month: '2026-07',
        base_amount: 520000,
        student_discount: 52000,
        prepaid_discount: 23000,
        final_amount: 445000,
        status: 'new',
      },
      {
        year_month: '2026-08',
        base_amount: 520000,
        student_discount: 52000,
        prepaid_discount: 23000,
        final_amount: 445000,
        status: 'new',
      },
      {
        year_month: '2026-09',
        base_amount: 520000,
        student_discount: 52000,
        prepaid_discount: 23000,
        final_amount: 445000,
        status: 'new',
      },
    ],
    total_final: 1335000,
    total_prepaid_discount: 69000,
    months_payable: 3,
    months_already_paid: 0,
  };
}

function makeState(overrides = {}) {
  return {
    hits: [],
    prepaidPayPayloads: [],
    prepaidPreviewPayloads: [],
    ...overrides,
  };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'chejump.com' || url.hostname === 'supermax.kr';

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

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, { settings: { academy_name: 'PACA 일산' } });
    }

    if (method === 'POST' && path === '/payments/prepaid-preview') {
      state.prepaidPreviewPayloads.push(request.postDataJSON());
      if (state.failPreview) {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, makePreview());
    }

    if (method === 'POST' && path === '/payments/prepaid-pay') {
      state.prepaidPayPayloads.push(request.postDataJSON());
      if (state.failPay) {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, {
        message: '선납 결제가 완료되었습니다.',
        months_processed: ['2026-07', '2026-08', '2026-09'],
        months_skipped: [],
        prepaid_group_id: 'prepaid-smoke',
        total_amount: 1335000,
        total_discount: 69000,
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function openPrepaidModal(page) {
  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByRole('button', { name: '선납 결제' }).click();
  await page.getByRole('heading', { name: '선납 할인 결제' }).waitFor();
}

async function runPreviewError(browser) {
  const state = makeState({ failPreview: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);

  await openPrepaidModal(page);
  await page.waitForResponse((response) => response.url().includes('/payments/prepaid-preview'));
  await page.waitForTimeout(100);
  await assertNoRawVisibleText(page, 'prepaid preview error');
  await page.getByText('선납 금액을 미리 계산하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoHorizontalOverflow(page, 'prepaid preview error');
  await page.screenshot({ path: '/Users/etlab/paca-student-prepaid-preview-error-mobile.png', fullPage: true });

  await context.close();
  return { diagnostics, state };
}

async function runPayError(browser) {
  const state = makeState({ failPay: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);

  await openPrepaidModal(page);
  await page.getByText('최종 납부').waitFor();
  const payResponse = page.waitForResponse((response) => response.url().includes('/payments/prepaid-pay'));
  await page.getByRole('button', { name: '선납 결제 확정' }).click();
  await payResponse;
  await page.waitForTimeout(100);
  await assertNoRawVisibleText(page, 'prepaid pay error');
  await page.getByText('선납 결제를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoHorizontalOverflow(page, 'prepaid pay error');
  await page.screenshot({ path: '/Users/etlab/paca-student-prepaid-pay-error-mobile.png', fullPage: true });

  if (state.prepaidPayPayloads.at(-1)?.payment_method !== 'account') {
    throw new Error(`unexpected prepaid pay payload: ${JSON.stringify(state.prepaidPayPayloads.at(-1))}`);
  }

  await context.close();
  return { diagnostics, state };
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const previewError = await runPreviewError(browser);
    const payError = await runPayError(browser);
    [previewError, payError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      previewErrorHits: previewError.state.hits,
      payErrorHits: payError.state.hits,
      payPayload: payError.state.prepaidPayPayloads.at(-1),
      previewConsoleErrors: previewError.diagnostics.consoleErrors,
      payConsoleErrors: payError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
