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

function makeSettings() {
  return {
    service_type: 'sens',
    naver_access_key: 'naver-access-key',
    naver_secret_key: '',
    naver_service_id: 'ncp:kkobizmsg:kr:paca',
    sms_service_id: 'ncp:sms:kr:paca',
    kakao_channel_id: '@paca',
    has_secret_key: true,
    template_code: 'PACA_UNPAID',
    template_content: '#{학생명} 학생의 수강료 납부 안내입니다.',
    sens_buttons: [],
    sens_image_url: '',
    sens_auto_enabled: true,
    sens_auto_hour: 10,
    sens_consultation_template_code: 'PACA_CONSULT',
    sens_consultation_template_content: '#{학생명} 학생 상담이 확정되었습니다.',
    sens_consultation_buttons: [],
    sens_consultation_image_url: '',
    sens_trial_template_code: 'PACA_TRIAL',
    sens_trial_template_content: '#{학생명} 학생 체험수업 안내입니다.',
    sens_trial_buttons: [],
    sens_trial_image_url: '',
    sens_trial_auto_enabled: false,
    sens_trial_auto_hour: 9,
    sens_overdue_template_code: 'PACA_OVERDUE',
    sens_overdue_template_content: '#{학생명} 학생 미납 안내입니다.',
    sens_overdue_buttons: [],
    sens_overdue_image_url: '',
    sens_overdue_auto_enabled: false,
    sens_overdue_auto_hour: 9,
    sens_reminder_template_code: 'PACA_REMINDER',
    sens_reminder_template_content: '#{학생명} 학생 상담 리마인드입니다.',
    sens_reminder_buttons: [],
    sens_reminder_image_url: '',
    sens_reminder_auto_enabled: false,
    sens_reminder_hours: 1,
    solapi_api_key: '',
    solapi_api_secret: '',
    solapi_pfid: '',
    solapi_sender_phone: '',
    has_solapi_secret: false,
    solapi_template_id: '',
    solapi_template_content: '',
    solapi_buttons: [],
    solapi_image_url: '',
    solapi_auto_enabled: false,
    solapi_auto_hour: 10,
    solapi_consultation_template_id: '',
    solapi_consultation_template_content: '',
    solapi_consultation_buttons: [],
    solapi_consultation_image_url: '',
    solapi_trial_template_id: '',
    solapi_trial_template_content: '',
    solapi_trial_buttons: [],
    solapi_trial_image_url: '',
    solapi_trial_auto_enabled: false,
    solapi_trial_auto_hour: 9,
    solapi_overdue_template_id: '',
    solapi_overdue_template_content: '',
    solapi_overdue_buttons: [],
    solapi_overdue_image_url: '',
    solapi_overdue_auto_enabled: false,
    solapi_overdue_auto_hour: 9,
    solapi_reminder_template_id: '',
    solapi_reminder_template_content: '',
    solapi_reminder_buttons: [],
    solapi_reminder_image_url: '',
    solapi_reminder_auto_enabled: false,
    solapi_reminder_hours: 1,
    solapi_attendance_template_id: '',
    solapi_attendance_template_content: '',
    solapi_attendance_buttons: [],
    solapi_attendance_image_url: '',
    sens_attendance_template_code: '',
    sens_attendance_template_content: '',
    sens_attendance_buttons: [],
    sens_attendance_image_url: '',
    attendance_alimtalk_enabled: true,
    is_enabled: true,
    solapi_enabled: false,
  };
}

function makeLog() {
  return {
    id: 701,
    academy_id: 1,
    student_id: 41,
    payment_id: null,
    recipient_name: '김진우 학부모',
    recipient_phone: '010-3333-4444',
    message_type: 'alimtalk',
    template_code: 'PACA_UNPAID',
    message_content: '납부 안내 알림톡',
    status: 'sent',
    error_message: null,
    request_id: 'alimtalk-701',
    sent_at: '2026-06-22T10:00:00.000Z',
    created_at: '2026-06-22T10:00:00.000Z',
    student_name: '김진우',
  };
}

function makeState(mode = 'success') {
  return { hits: [], mode };
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

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, { settings: { academy_name: 'PACA 일산' } });
    }

    if (method === 'GET' && path === '/consultations') {
      return jsonRoute(route, {
        consultations: [],
        pagination: { total: 0, page: 1, limit: 1, totalPages: 0 },
        stats: { total: 0, pending: 0, confirmed: 0 },
      });
    }

    if (method === 'GET' && path === '/notifications/settings') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'ok', settings: makeSettings() });
    }

    if (method === 'GET' && path === '/notifications/logs') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        message: 'ok',
        logs: [makeLog()],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
    }

    if (method === 'GET' && path === '/sms/sender-numbers') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        senderNumbers: [
          { id: 7, service_type: 'sens', phone: '010-2144-6755', label: '대표', is_default: 1, created_at: '2026-06-01T09:00:00.000Z' },
        ],
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createNotificationsPage(browser, viewport = { width: 1365, height: 900 }, mode = 'success') {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function runDesktop(browser) {
  const result = await createNotificationsPage(browser);
  const { context, page } = result;

  await page.goto('/settings/notifications', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '알림톡 및 SMS 설정' }).waitFor();
  await page.getByRole('heading', { name: '네이버 SENS API 설정' }).waitFor();
  await page.getByText('010-2144-6755', { exact: true }).waitFor();
  await page.getByText('김진우 학부모').waitFor();
  await assertNoRawVisibleText(page, 'notifications desktop');
  await assertNoHorizontalOverflow(page, 'notifications desktop');
  await page.screenshot({ path: '/Users/etlab/paca-notifications-desktop.png', fullPage: true });

  const sensButton = page.getByRole('button', { name: '네이버 SENS' });
  const solapiButton = page.getByRole('button', { name: '솔라피 (Solapi)' });
  await solapiButton.click();
  await page.getByRole('heading', { name: '솔라피 API 설정' }).waitFor();
  await page.getByRole('heading', { name: '알림톡 템플릿 설정' }).waitFor();
  await page.getByText('솔라피 콘솔에서 이미지 업로드').first().waitFor();
  if (await solapiButton.getAttribute('aria-pressed') !== 'true') {
    throw new Error('solapi service button was not selected');
  }
  if (await sensButton.getAttribute('aria-pressed') !== 'false') {
    throw new Error('sens service button was not deselected');
  }
  const solapiClassName = await solapiButton.getAttribute('class');
  const sensClassName = await sensButton.getAttribute('class');
  if (!solapiClassName?.includes('bg-blue-600')) {
    throw new Error(`solapi service button did not receive selected styling: ${solapiClassName}`);
  }
  if (sensClassName?.includes('bg-blue-600')) {
    throw new Error(`sens service button kept selected styling: ${sensClassName}`);
  }
  await assertNoRawVisibleText(page, 'notifications solapi desktop');
  await assertNoHorizontalOverflow(page, 'notifications solapi desktop');
  await page.screenshot({ path: '/Users/etlab/paca-notifications-solapi-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobile(browser) {
  const result = await createNotificationsPage(browser, { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/settings/notifications', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '알림톡 및 SMS 설정' }).waitFor();
  await page.getByText('010-2144-6755', { exact: true }).waitFor();
  await assertNoRawVisibleText(page, 'notifications mobile');
  await assertNoHorizontalOverflow(page, 'notifications mobile');
  await page.screenshot({ path: '/Users/etlab/paca-notifications-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createNotificationsPage(browser, { width: 390, height: 844 }, 'load-error');
  const { context, page } = result;

  await page.goto('/settings/notifications', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '알림톡 준비 정보를 일부 불러오지 못했습니다' }).waitFor();
  await page.getByText('알림톡 설정을 불러오지 못했습니다').waitFor();
  await page.getByText('발송 내역을 불러오지 못했습니다').waitFor();
  await page.getByText('발신번호 정보를 불러오지 못했습니다').waitFor();
  await assertNoRawVisibleText(page, 'notifications load error');
  await assertNoHorizontalOverflow(page, 'notifications load error');
  await page.screenshot({ path: '/Users/etlab/paca-notifications-error-mobile.png', fullPage: true });

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
    const loadError = await runLoadError(browser);
    [desktop, mobile, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      errorHits: loadError.state.hits,
      mobileHits: mobile.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
