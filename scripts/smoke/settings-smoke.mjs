import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createAuthedContext,
  createDiagnostics,
  jsonRoute,
  launchSmokeBrowser,
  isPacaApiRequest,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

function makeState(mode = 'success') {
  return {
    academyPayload: null,
    hits: [],
    mode,
    operationPayload: null,
    resetPayload: null,
  };
}

function academySettings() {
  return {
    academy_name: 'PACA 일산',
    phone: '031-900-0000',
    address: '경기 고양시 일산동구',
    business_number: '123-45-67890',
    tuition_due_day: 5,
    salary_payment_day: 10,
    salary_month_type: 'next',
    morning_class_time: '09:30-12:00',
    afternoon_class_time: '14:00-18:00',
    evening_class_time: '18:30-21:00',
    exam_tuition: {
      weekly_1: 210000,
      weekly_2: 320000,
      weekly_3: 430000,
      weekly_4: 520000,
      weekly_5: 610000,
      weekly_6: 700000,
      weekly_7: 780000,
    },
    adult_tuition: {
      weekly_1: 160000,
      weekly_2: 240000,
      weekly_3: 310000,
      weekly_4: 390000,
      weekly_5: 470000,
      weekly_6: 540000,
      weekly_7: 600000,
    },
    season_fees: {
      exam_early: 1200000,
      exam_regular: 1500000,
      civil_service: 900000,
    },
    season_monthly_policy: 'season_replaces_monthly',
  };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = isPacaApiRequest(url);

    if (!isApi) return route.continue();

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}`);

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }

    if (method === 'GET' && path === '/auth/me') {
      return jsonRoute(route, {
        user: {
          id: 1,
          email: 'owner@example.com',
          name: '원장',
          role: 'owner',
        },
      });
    }

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, { settings: academySettings() });
    }

    if (method === 'GET' && path === '/settings') {
      return jsonRoute(route, {
        settings: {
          morning_class_time: '09:30-12:00',
          afternoon_class_time: '14:00-18:00',
          evening_class_time: '18:30-21:00',
          salary_payment_day: 10,
          salary_month_type: 'next',
        },
      });
    }

    if (method === 'PUT' && path === '/settings/academy') {
      state.academyPayload = JSON.parse(request.postData() || '{}');
      if (state.mode === 'save-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'saved' });
    }

    if (method === 'PUT' && path === '/settings') {
      state.operationPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'saved' });
    }

    if (method === 'POST' && path === '/settings/reset-database') {
      state.resetPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'reset' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createSettingsPage(browser, mode = 'success', viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function clickWithoutNativeDialog(page, locator, label) {
  const nativeDialog = page
    .waitForEvent('dialog', { timeout: 800 })
    .then(async (dialog) => {
      const message = dialog.message();
      await dialog.dismiss();
      return message;
    })
    .catch(() => null);

  await locator.click();
  const message = await nativeDialog;
  if (message) throw new Error(`${label} opened native browser dialog: ${message}`);
}

async function runDesktop(browser) {
  const result = await createSettingsPage(browser);
  const { context, page } = result;

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
  const operationNav = page.getByRole('navigation', { name: '운영 설정 바로가기' });
  await operationNav.waitFor();
  await operationNav.getByText('PACA 일산').waitFor();
  await page.getByText('저장됨').first().waitFor();
  await page.getByRole('link', { name: '학원비 바로가기' }).waitFor();
  await page.getByRole('link', { name: '급여 설정 바로가기' }).waitFor();
  const seasonLinkCount = await page.getByRole('link', { name: '시즌비 바로가기' }).count();
  if (seasonLinkCount !== 0) throw new Error('settings page should not expose season fee shortcut');
  const seasonPolicyCount = await page.getByRole('radio', { name: /시즌비가 월납부를 대체/ }).count();
  if (seasonPolicyCount !== 0) throw new Error('settings page should not expose season monthly policy radios');
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '앱 설치' }), 'topnav install guide');
  await page.getByText('브라우저 메뉴에서 앱 설치를 선택해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'settings desktop');
  await assertNoHorizontalOverflow(page, 'settings desktop');
  await page.screenshot({ path: '/Users/etlab/paca-settings-desktop.png', fullPage: true });
  await page.getByRole('link', { name: '수업 시간 바로가기' }).click();
  await page.getByRole('heading', { name: '수업 시간대' }).waitFor();

  await context.close();
  return result;
}

async function runResetFlow(browser) {
  const result = await createSettingsPage(browser);
  const { context, page, state } = result;

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
  await page.getByPlaceholder('초기화').fill('초기화');
  await clickWithoutNativeDialog(
    page,
    page.getByRole('button', { name: '전체 데이터 초기화' }),
    'settings reset'
  );
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('heading', { name: '전체 데이터 초기화 확인' }).waitFor();
  await dialog.getByText('학생, 강사, 수납, 급여, 스케줄, 시즌 정보를 모두 삭제합니다.').waitFor();
  const resetResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST' && normalizePacaApiPath(url) === '/settings/reset-database';
  });
  await dialog.getByRole('button', { name: '초기화' }).click();
  await resetResponse;
  if (state.resetPayload?.confirmation !== '초기화') {
    throw new Error(`reset payload mismatch: ${JSON.stringify(state.resetPayload)}`);
  }

  await context.close();
  return result;
}

async function runSaveFlow(browser) {
  const result = await createSettingsPage(browser);
  const { context, page, state } = result;

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
  await page.getByRole('navigation', { name: '운영 설정 바로가기' }).getByText('PACA 일산').waitFor();
  await page.getByText('저장됨').first().waitFor();
  await page.getByLabel('오전반 시작 시간').selectOption('08:00');
  await page.getByLabel('입시반 주3회 학원비').fill('450000');
  await page.getByText('변경 사항 있음').first().waitFor();
  await page.getByRole('button', { name: /저장/ }).first().click();
  await page.getByText('학원 설정이 저장되었습니다.').waitFor();

  if (!state.academyPayload) throw new Error('academy settings payload was not sent');
  if (!state.operationPayload) throw new Error('operation settings payload was not sent');
  if (state.academyPayload.morning_class_time !== '08:00-12:00') {
    throw new Error(`morning_class_time mismatch: ${JSON.stringify(state.academyPayload)}`);
  }
  if (state.operationPayload.morning_class_time !== '08:00-12:00') {
    throw new Error(`operation payload mismatch: ${JSON.stringify(state.operationPayload)}`);
  }
  if (state.academyPayload.exam_tuition?.weekly_3 !== 450000) {
    throw new Error(`tuition payload mismatch: ${JSON.stringify(state.academyPayload.exam_tuition)}`);
  }
  if ('season_fees' in state.academyPayload || 'season_monthly_policy' in state.academyPayload) {
    throw new Error(`settings save should not send season fields: ${JSON.stringify(state.academyPayload)}`);
  }
  await page.getByText('저장됨').first().waitFor();
  await assertNoRawVisibleText(page, 'settings save flow');
  await assertNoHorizontalOverflow(page, 'settings save flow');
  await page.screenshot({ path: '/Users/etlab/paca-settings-save.png', fullPage: true });

  await context.close();
  return result;
}

async function runSaveError(browser) {
  const result = await createSettingsPage(browser, 'save-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
  await page.getByRole('navigation', { name: '운영 설정 바로가기' }).getByText('PACA 일산').waitFor();
  await page.getByLabel('학원명').fill('PACA 강남');
  await page.getByRole('button', { name: /저장/ }).first().click();
  await page.getByText('설정을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'settings save error');
  await assertNoHorizontalOverflow(page, 'settings save error');
  await page.screenshot({ path: '/Users/etlab/paca-settings-save-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobile(browser) {
  const result = await createSettingsPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
  const operationNav = page.getByRole('navigation', { name: '운영 설정 바로가기' });
  await operationNav.waitFor();
  await operationNav.getByText('PACA 일산').waitFor();
  await page.getByRole('link', { name: '학원비 바로가기' }).waitFor();
  await assertNoRawVisibleText(page, 'settings mobile');
  await assertNoHorizontalOverflow(page, 'settings mobile');
  await page.screenshot({ path: '/Users/etlab/paca-settings-mobile.png', fullPage: true });

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
    const desktop = await runDesktop(browser);
    const mobile = await runMobile(browser);
    const saveFlow = await runSaveFlow(browser);
    const saveError = await runSaveError(browser);
    const resetFlow = await runResetFlow(browser);
    [desktop, mobile, saveFlow, saveError, resetFlow].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      mobileHits: mobile.state.hits,
      resetPayload: resetFlow.state.resetPayload,
      savePayload: saveFlow.state.academyPayload,
      operationPayload: saveFlow.state.operationPayload,
      saveErrorHits: saveError.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
