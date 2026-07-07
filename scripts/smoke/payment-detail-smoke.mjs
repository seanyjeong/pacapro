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

function makePayment() {
  return {
    id: 301,
    student_id: 41,
    student_name: '박민수',
    student_number: 'S-2026-041',
    year_month: '2026-05',
    payment_type: 'monthly',
    base_amount: 560000,
    discount_amount: 40000,
    additional_amount: 0,
    final_amount: 520000,
    paid_amount: 120000,
    paid_date: '2026-06-15',
    due_date: '2026-05-10',
    payment_status: 'partial',
    payment_method: 'account',
    description: '5월 수강료',
    notes: '분납 상담 완료',
    created_at: '2026-05-01T09:00:00Z',
    updated_at: '2026-06-15T09:00:00Z',
  };
}

function emptyPaymentStats() {
  return {
    message: 'ok',
    stats: {
      total_count: 0,
      paid_count: 0,
      partial_count: 0,
      unpaid_count: 0,
      total_expected: 0,
      total_collected: 0,
      total_outstanding: 0,
    },
  };
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

    if (state.failLoad && method === 'GET' && path === '/payments/301') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/payments/301') {
      return jsonRoute(route, { payment: state.payment });
    }
    if (method === 'PUT' && path === '/payments/301') {
      const payload = request.postDataJSON();
      state.putPayload = payload;
      state.payment.paid_date = payload.paid_date;
      return jsonRoute(route, { message: 'updated', payment: state.payment });
    }
    if (method === 'POST' && path === '/payments/301/pay') {
      const payload = request.postDataJSON();
      state.payPayload = payload;
      state.payment.paid_amount += payload.paid_amount;
      state.payment.payment_method = payload.payment_method;
      state.payment.paid_date = payload.payment_date;
      state.payment.payment_status = state.payment.paid_amount >= state.payment.final_amount ? 'paid' : 'partial';
      return jsonRoute(route, { message: 'paid', payment: state.payment });
    }
    if (method === 'POST' && path === '/payments/301/cancel') {
      const payload = request.postDataJSON();
      state.cancelPayload = payload;
      state.payment.paid_amount = Math.max(0, state.payment.paid_amount - payload.cancel_amount);
      state.payment.payment_status = state.payment.paid_amount === 0 ? 'pending' : 'partial';
      if (state.payment.paid_amount === 0) {
        state.payment.paid_date = null;
        state.payment.payment_method = null;
      }
      state.payment.notes = `${state.payment.notes}\n[납부취소] ${payload.cancel_date} ${payload.cancel_amount}원 취소 - ${payload.cancel_reason}`;
      return jsonRoute(route, { message: '결제 취소가 기록되었습니다.', payment: state.payment });
    }
    if (method === 'DELETE' && path === '/payments/301') {
      state.deleted = true;
      return jsonRoute(route, { message: 'deleted', payment: { id: 301, student_name: '박민수' } });
    }
    if (method === 'GET' && path === '/payments/stats/summary') return jsonRoute(route, emptyPaymentStats());
    if (method === 'GET' && path === '/payments') return jsonRoute(route, { message: 'ok', payments: [] });

    return jsonRoute(route, { message: 'mocked' });
  });
}

function makeState(failLoad = false) {
  return { payment: makePayment(), hits: [], externalContinues: [], failLoad, deleted: false };
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

  await page.goto('/payments/301', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '학원비 상세' }).waitFor();
  await page.getByText('박민수').waitFor();
  await page.getByText('총 청구', { exact: true }).waitFor();
  await page.getByText('이미 납부', { exact: true }).waitFor();
  await page.getByText('남은 금액', { exact: true }).waitFor();
  await page.getByText('400,000원').first().waitFor();
  await assertNoRawVisibleText(page, 'payment detail desktop');
  await assertNoHorizontalOverflow(page, 'payment detail desktop');
  await page.screenshot({ path: '/Users/etlab/paca-payment-detail-desktop.png', fullPage: true });

  await page.locator('section:has-text("납부 정보") button').first().click();
  await page.locator('section:has-text("납부 정보") input[type="date"]').fill('2026-06-20');
  await page.locator('section:has-text("납부 정보") button').first().click();
  await page.getByText('납부일이 수정되었습니다.').waitFor();
  if (state.putPayload?.paid_date !== '2026-06-20') throw new Error(`unexpected paid date payload ${JSON.stringify(state.putPayload)}`);

  await page.getByRole('button', { name: '결제 취소' }).first().click();
  await page.getByRole('dialog').getByRole('heading', { name: '결제 취소' }).waitFor();
  const cancelAmountInput = page.getByLabel('취소 금액');
  await cancelAmountInput.waitFor();
  if ((await cancelAmountInput.inputValue()) !== '120,000') {
    throw new Error(`initial cancel amount did not use paid amount: ${await cancelAmountInput.inputValue()}`);
  }
  await cancelAmountInput.fill('50000');
  await page.getByLabel('취소일').fill('2026-07-07');
  await page.getByLabel('취소 사유').fill('카드 승인 취소');
  await page.getByRole('dialog').getByRole('button', { name: '결제 취소하기' }).click();
  await page.getByText('결제 취소가 기록되었습니다.').waitFor();
  if (state.cancelPayload?.cancel_amount !== 50000) throw new Error(`unexpected cancel payload ${JSON.stringify(state.cancelPayload)}`);
  if (state.cancelPayload?.cancel_reason !== '카드 승인 취소') throw new Error(`unexpected cancel reason ${JSON.stringify(state.cancelPayload)}`);
  await page.getByText('450,000원').first().waitFor();
  await page.getByText('카드 승인 취소').waitFor();

  await page.getByRole('button', { name: '납부 기록' }).first().click();
  const paymentAmountInput = page.getByLabel('납부 금액');
  await paymentAmountInput.waitFor();
  if ((await paymentAmountInput.inputValue()) !== '450,000') {
    throw new Error(`initial payment amount did not use remaining amount: ${await paymentAmountInput.inputValue()}`);
  }
  await paymentAmountInput.fill('100000');
  await page.locator('form').getByRole('button', { name: '납부 기록' }).click();
  await page.getByText('납부가 기록되었습니다.').waitFor();
  if (state.payPayload?.paid_amount !== 100000) throw new Error(`unexpected payment payload ${JSON.stringify(state.payPayload)}`);
  if (state.payPayload?.payment_method !== 'account') throw new Error(`unexpected payment method ${JSON.stringify(state.payPayload)}`);
  await page.getByText('350,000원').first().waitFor();
  await page.getByRole('button', { name: '납부 기록' }).first().click();
  await paymentAmountInput.waitFor();
  if ((await paymentAmountInput.inputValue()) !== '350,000') {
    throw new Error(`reopened payment amount did not reset to remaining amount: ${await paymentAmountInput.inputValue()}`);
  }
  await page.getByRole('button', { name: '납부 기록 닫기' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '학원비 상세' }).waitFor();
  await assertNoRawVisibleText(page, 'payment detail mobile');
  await assertNoHorizontalOverflow(page, 'payment detail mobile');
  await page.screenshot({ path: '/Users/etlab/paca-payment-detail-mobile.png', fullPage: true });

  await page.getByRole('button', { name: '삭제' }).click();
  await page.getByRole('alertdialog').getByText('학원비 청구 삭제').waitFor();
  await page.getByRole('alertdialog').getByText('삭제 후에는 목록에서 확인할 수 없습니다.').waitFor();
  await page.waitForTimeout(250);
  await page.screenshot({ path: '/Users/etlab/paca-payment-delete-dialog-mobile.png', fullPage: true });
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제' }).click();
  await page.waitForURL('**/payments');
  if (!state.deleted) throw new Error('delete endpoint not called');
  if (nativeDialogMessage) throw new Error(`unexpected native dialog: ${nativeDialogMessage}`);

  await context.close();
  return { state, diagnostics };
}

async function runError(browser) {
  const state = makeState(true);
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/payments/301', { waitUntil: 'networkidle' });
  await page.getByText('학원비 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'payment detail error');
  await assertNoHorizontalOverflow(page, 'payment detail error');
  await page.screenshot({ path: '/Users/etlab/paca-payment-detail-error-mobile.png', fullPage: true });

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
    assertDiagnostics(normal);
    assertDiagnostics(error);
    console.log(JSON.stringify({
      normalHits: normal.state.hits,
      putPayload: normal.state.putPayload,
      cancelPayload: normal.state.cancelPayload,
      payPayload: normal.state.payPayload,
      deleted: normal.state.deleted,
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
