import {
  DEFAULT_BASE_URL,
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createAuthedContext,
  createDiagnostics,
  jsonRoute,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

function makeSalary() {
  return {
    id: 201,
    instructor_id: 11,
    instructor_name: '김강사',
    year_month: '2026-05',
    salary_type: 'per_class',
    hourly_rate: '50000',
    morning_class_rate: '45000',
    afternoon_class_rate: '50000',
    evening_class_rate: '55000',
    base_salary: '0',
    base_amount: 1145000,
    incentive_amount: 30000,
    total_deduction: 10000,
    tax_type: 'insurance',
    tax_amount: 111250,
    insurance_details: {
      nationalPension: 54380,
      healthInsurance: 41120,
      longTermCare: 5400,
      employmentInsurance: 10350,
    },
    net_salary: 1053750,
    payment_status: 'pending',
    payment_date: null,
    created_at: '2026-06-01T09:00:00Z',
    updated_at: '2026-06-02T09:00:00Z',
  };
}

const attendanceSummary = {
  work_year_month: '2026-05',
  attendance_days: 12,
  total_classes: 23,
  morning_classes: 7,
  afternoon_classes: 9,
  evening_classes: 7,
  total_hours: 46,
  daily_breakdown: {
    '2026-05-04': {
      slots: ['morning', 'afternoon'],
      details: [
        { time_slot: 'morning', time_slot_label: '오전', check_in_time: '09:00', check_out_time: '12:00', attendance_status: 'present' },
        { time_slot: 'afternoon', time_slot_label: '오후', check_in_time: '13:00', check_out_time: '16:00', attendance_status: 'present' },
      ],
    },
    '2026-05-05': {
      slots: ['evening'],
      details: [
        { time_slot: 'evening', time_slot_label: '저녁', check_in_time: '18:00', check_out_time: '21:00', attendance_status: 'present' },
      ],
    },
  },
};

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocal = url.origin === DEFAULT_BASE_URL;
    const isApi = url.hostname === 'chejump.com' || url.hostname === 'supermax.kr';

    if (!isApi) {
      if (!isLocal) state.externalContinues.push(request.url());
      return route.continue();
    }

    const path = normalizePacaApiPath(url);
    const method = request.method();
    state.hits.push(`${method} ${path}${url.search}`);

    if (state.failLoad && method === 'GET' && path === '/salaries/201') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/salaries/201') {
      return jsonRoute(route, { salary: state.salary, attendance_summary: attendanceSummary });
    }
    if (method === 'PUT' && path === '/salaries/201') {
      const payload = request.postDataJSON();
      state.putPayload = payload;
      state.salary.incentive_amount = payload.incentive_amount;
      state.salary.net_salary = state.salary.base_amount + payload.incentive_amount - state.salary.total_deduction - state.salary.tax_amount;
      return jsonRoute(route, { message: 'updated', salary: state.salary });
    }
    if (method === 'POST' && path === '/salaries/201/recalculate') {
      state.recalculatePayload = request.postData() || '';
      state.salary.base_amount = 1150000;
      state.salary.net_salary = state.salary.base_amount + state.salary.incentive_amount - state.salary.total_deduction - state.salary.tax_amount;
      return jsonRoute(route, { message: 'recalculated', salary: { base_amount: state.salary.base_amount, net_salary: state.salary.net_salary } });
    }
    if (method === 'POST' && path === '/salaries/201/pay') {
      state.payPayload = request.postDataJSON();
      state.salary.payment_status = 'paid';
      state.salary.payment_date = '2026-06-22';
      return jsonRoute(route, { message: 'paid', salary: state.salary });
    }
    if (method === 'POST' && path === '/auth/verify-password') {
      state.verifyPayload = request.postDataJSON();
      return jsonRoute(route, { message: 'verified', verified: true });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

function makeState(failLoad = false) {
  return { salary: makeSalary(), hits: [], externalContinues: [], failLoad };
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

  await page.goto('/salaries/201', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '급여 명세서' }).waitFor();
  await page.getByText('김강사').waitFor();
  await page.getByText('오전: 45,000원 x 7회 = 315,000원').waitFor();
  await page.getByText('국민연금').waitFor();
  await assertNoRawVisibleText(page, 'desktop normal');
  await assertNoHorizontalOverflow(page, 'desktop normal');
  await page.screenshot({ path: '/Users/etlab/paca-salary-detail-desktop.png', fullPage: true });

  await page.getByRole('button', { name: '인센티브 수정' }).click();
  await page.getByLabel('인센티브 금액').fill('125000');
  await page.getByRole('button', { name: '인센티브 저장' }).click();
  await page.getByText('인센티브가 저장되었습니다.').waitFor();
  if (state.putPayload?.incentive_amount !== 125000) throw new Error(`unexpected incentive payload ${JSON.stringify(state.putPayload)}`);

  await page.getByRole('button', { name: /재계산/ }).first().click();
  await page.getByRole('alertdialog').getByRole('heading', { name: '급여 재계산' }).waitFor();
  await page.getByRole('alertdialog').getByRole('button', { name: '재계산' }).click();
  await page.getByText(/재계산 완료/).waitFor();
  if (!state.hits.includes('POST /salaries/201/recalculate')) throw new Error('recalculate endpoint not called');
  if (nativeDialogMessage) throw new Error(`unexpected native dialog: ${nativeDialogMessage}`);

  await page.getByRole('button', { name: /지급 완료/ }).first().click();
  await page.getByLabel('비밀번호').fill('secret-pass');
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByText('급여 지급 처리가 완료되었습니다.').waitFor();
  if (state.verifyPayload?.password !== 'secret-pass') throw new Error(`unexpected verify payload ${JSON.stringify(state.verifyPayload)}`);
  if (!state.hits.includes('POST /salaries/201/pay')) throw new Error('pay endpoint not called');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '급여 명세서' }).waitFor();
  await assertNoRawVisibleText(page, 'mobile normal');
  await assertNoHorizontalOverflow(page, 'mobile normal');
  await page.screenshot({ path: '/Users/etlab/paca-salary-detail-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runError(browser) {
  const state = makeState(true);
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/salaries/201', { waitUntil: 'networkidle' });
  await page.getByRole('alert').getByRole('heading', { name: '급여 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByText('급여 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile error');
  await assertNoHorizontalOverflow(page, 'mobile error');
  await page.screenshot({ path: '/Users/etlab/paca-salary-detail-error-mobile.png', fullPage: true });

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
      verifyPayload: normal.state.verifyPayload,
      payPayload: normal.state.payPayload,
      recalculatePayload: normal.state.recalculatePayload,
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
