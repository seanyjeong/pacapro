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
    solapi_template_content: '#{이름} 학생의 #{월}월 학원비 안내입니다.',
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
    solapi_attendance_template_id: 'PACA_SOLAPI_ATTENDANCE',
    solapi_attendance_template_content: '안녕하세요. #{학원명} 입니다.\n#{이름} 학생이 #{월} #{일} #{요일} 요일 수업 #{출결상태} 하였습니다.',
    solapi_attendance_buttons: [],
    solapi_attendance_image_url: '',
    sens_attendance_template_code: 'PACA_SENS_ATTENDANCE',
    sens_attendance_template_content: '안녕하세요. #{학원명}입니다.\n#{이름} 학생이 #{월}월 #{일}일 #{요일}요일 수업 #{출결상태}하였습니다.',
    sens_attendance_buttons: [],
    sens_attendance_image_url: '',
    attendance_alimtalk_enabled: true,
    is_enabled: true,
    solapi_enabled: true,
  };
}

function makeLog() {
  return {
    id: 701,
    academy_id: 1,
    student_id: 41,
    payment_id: 501,
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
  return {
    deletedSenderId: null,
    hits: [],
    mode,
    sensAttendancePayload: null,
    solapiAttendancePayload: null,
    testErrorAuthHeader: null,
    unpaidPayload: null,
  };
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

    if (method === 'DELETE' && path === '/sms/sender-numbers/7') {
      state.deletedSenderId = 7;
      return jsonRoute(route, { message: '발신번호가 삭제되었습니다.' });
    }

    if (method === 'POST' && path === '/notifications/send-unpaid') {
      state.unpaidPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: '발송 완료', sent: 3, failed: 1 });
    }

    if (method === 'POST' && path === '/notifications/test-attendance') {
      state.solapiAttendancePayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'ok', success: true, groupId: 'attendance-test-1' });
    }

    if (method === 'POST' && path === '/notifications/test-sens-attendance') {
      state.sensAttendancePayload = JSON.parse(request.postData() || '{}');
      if (state.mode === 'test-send-error') {
        state.testErrorAuthHeader = request.headers().authorization;
        return jsonRoute(route, {
          error: 'Send Failed',
          message: '테스트 발송에 실패했습니다.',
          details: { errorMessage: '허용되지 않은 IP(192.0.2.1)로 접근하고 있습니다.' },
        }, 400);
      }
      return jsonRoute(route, { message: 'ok', success: true, requestId: 'sens-attendance-test-1' });
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

async function waitForToast(page, type, text) {
  const toast = page.locator(`[data-sonner-toast][data-type="${type}"]`).filter({ hasText: text }).first();
  await toast.waitFor();
  return toast;
}

async function runDesktop(browser) {
  const result = await createNotificationsPage(browser);
  const { context, page, state } = result;

  await page.goto('/settings/notifications', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '알림톡 및 SMS 설정' }).waitFor();
  await assertOperationsBoard(page, { service: '네이버 SENS' });
  await page.getByRole('heading', { name: '네이버 SENS API 설정' }).waitFor();
  await page.getByText('010-2144-6755', { exact: true }).waitFor();
  await page.getByText('김진우 학부모').waitFor();
  const studentLink = page.getByRole('link', { name: '김진우 학부모 학생 상세 보기' });
  await studentLink.waitFor();
  if ((await studentLink.getAttribute('href')) !== '/students/41') {
    throw new Error('missing notification student detail link');
  }
  const paymentLink = page.getByRole('link', { name: '김진우 학부모 결제 상세 보기' });
  await paymentLink.waitFor();
  if ((await paymentLink.getAttribute('href')) !== '/payments/501') {
    throw new Error('missing notification payment detail link');
  }

  await page.getByRole('button', { name: '출결관리 설정됨' }).click();
  await page.getByLabel('SENS 출결 테스트 전화번호').fill('01055556666');
  await page.getByRole('button', { name: '출결 테스트' }).click();
  await waitForToast(page, 'success', 'SENS 출결관리 테스트 메시지가 발송되었습니다.');
  if (state.sensAttendancePayload?.phone !== '01055556666') {
    throw new Error(`sens attendance payload mismatch: ${JSON.stringify(state.sensAttendancePayload)}`);
  }

  await clickWithoutNativeDialog(
    page,
    page.getByRole('button', { name: '010-2144-6755 발신번호 삭제' }),
    'notification sender delete'
  );
  const deleteDialog = page.getByRole('alertdialog');
  await deleteDialog.getByRole('heading', { name: '발신번호 삭제 확인' }).waitFor();
  await deleteDialog.getByText('010-2144-6755 발신번호를 삭제합니다.').waitFor();
  await deleteDialog.getByRole('button', { name: '삭제' }).click();
  await page.getByText('발신번호가 삭제되었습니다.').waitFor();
  await deleteDialog.waitFor({ state: 'hidden' });
  if (state.deletedSenderId !== 7) {
    throw new Error(`sender delete id mismatch: ${state.deletedSenderId}`);
  }

  await assertNoRawVisibleText(page, 'notifications desktop');
  await assertNoHorizontalOverflow(page, 'notifications desktop');
  await page.screenshot({ path: '/Users/etlab/paca-notifications-desktop.png', fullPage: true });

  await page.getByRole('button', { name: '가격 비교' }).click();
  await page.getByTestId('notification-price-modal').waitFor();
  await page.getByRole('heading', { name: '발송 단가 비교' }).waitFor();
  await assertNoRawVisibleText(page, 'notifications price modal');
  await assertNoHorizontalOverflow(page, 'notifications price modal');
  await page.screenshot({ path: '/Users/etlab/paca-notifications-price-modal.png', fullPage: true });
  await page.getByRole('button', { name: '가격 비교 닫기' }).click();
  await page.getByTestId('notification-price-modal').waitFor({ state: 'hidden' });

  const serviceTabs = page.getByTestId('notification-service-tabs');
  const sensButton = serviceTabs.getByRole('button', { name: '네이버 SENS' });
  const solapiButton = serviceTabs.getByRole('button', { name: '솔라피 (Solapi)' });
  await solapiButton.click();
  await page.getByRole('heading', { name: '솔라피 API 설정' }).waitFor();
  await page.getByRole('heading', { name: '알림톡 템플릿 설정' }).waitFor();
  await page.getByTestId('alimtalk-preview-card').waitFor();
  await page.getByText('홍길동 학생의 12월 학원비 안내입니다.').waitFor();
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
  await clickWithoutNativeDialog(
    page,
    page.getByRole('button', { name: /월 미납자에게 즉시 발송/ }),
    'notification unpaid send'
  );
  const sendDialog = page.getByRole('alertdialog');
  await sendDialog.getByRole('heading', { name: '미납자 알림톡 발송 확인' }).waitFor();
  await sendDialog.getByText(/미납자에게 알림톡을 발송합니다/).waitFor();
  await sendDialog.getByRole('button', { name: '발송' }).click();
  await page.getByText('발송 완료: 3명 성공, 1명 실패').waitFor();
  await sendDialog.waitFor({ state: 'hidden' });
  if (state.unpaidPayload?.month !== new Date().getMonth() + 1) {
    throw new Error(`unpaid send payload mismatch: ${JSON.stringify(state.unpaidPayload)}`);
  }

  await page.getByRole('button', { name: '출결관리 알림톡' }).click();
  await page.getByLabel('솔라피 출결 테스트 전화번호').fill('01077778888');
  await page.getByRole('button', { name: '출결 테스트' }).click();
  await waitForToast(page, 'success', '출결관리 테스트 메시지가 발송되었습니다.');
  if (state.solapiAttendancePayload?.phone !== '01077778888') {
    throw new Error(`solapi attendance payload mismatch: ${JSON.stringify(state.solapiAttendancePayload)}`);
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
  await assertOperationsBoard(page, { service: '네이버 SENS' });
  await page.getByTestId('notifications-operations-board').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/Users/etlab/paca-notifications-mobile-board.png', fullPage: false });
  await page.getByText('010-2144-6755', { exact: true }).waitFor();
  await page.getByRole('link', { name: '김진우 학부모 학생 상세 보기' }).waitFor();
  await page.getByRole('link', { name: '김진우 학부모 결제 상세 보기' }).waitFor();
  await assertNoRawVisibleText(page, 'notifications mobile');
  await assertNoHorizontalOverflow(page, 'notifications mobile');
  await page.screenshot({ path: '/Users/etlab/paca-notifications-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runAttendanceDeepLink(browser) {
  const result = await createNotificationsPage(browser);
  const { context, page, state } = result;

  await page.goto('/settings/notifications?service=solapi&template=attendance', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '알림톡 및 SMS 설정' }).waitFor();
  await page.getByRole('heading', { name: '솔라피 API 설정' }).waitFor();
  await assertOperationsBoard(page, { service: '솔라피' });
  const preview = page.getByTestId('alimtalk-preview-card');
  await preview.getByText('홍길동 학생이 5월 18일 월요일 수업 출석 하였습니다.').waitFor();
  if (await preview.getByText('5 18 월 요일').count()) {
    throw new Error('attendance preview showed raw split date variables');
  }
  await page.getByLabel('솔라피 출결 테스트 전화번호').fill('01099990000');
  await page.getByRole('button', { name: '출결 테스트' }).click();
  await waitForToast(page, 'success', '출결관리 테스트 메시지가 발송되었습니다.');
  if (state.solapiAttendancePayload?.phone !== '01099990000') {
    throw new Error(`attendance deep link payload mismatch: ${JSON.stringify(state.solapiAttendancePayload)}`);
  }

  await assertNoRawVisibleText(page, 'notifications attendance deep link');
  await assertNoHorizontalOverflow(page, 'notifications attendance deep link');
  await page.screenshot({ path: '/Users/etlab/paca-notifications-attendance-deeplink.png', fullPage: true });

  await context.close();
  return result;
}

async function assertOperationsBoard(page, options = {}) {
  const expected = { service: '네이버 SENS', ...options };
  const board = page.getByTestId('notifications-operations-board');
  await board.getByRole('heading', { name: '알림톡 작업 보드' }).waitFor();
  await board.getByTestId('notifications-board-metric-service').getByText(expected.service).waitFor();
  await board.getByTestId('notifications-board-metric-status').getByText('발송 가능').waitFor();
  await board.getByTestId('notifications-board-metric-senders').getByText('1개').waitFor();
  await board.getByRole('button', { name: '네이버 SENS' }).waitFor();
  await board.getByRole('button', { name: '솔라피' }).waitFor();
  await board.getByRole('button', { name: '출결관리 템플릿 열기' }).waitFor();
  await board.getByRole('link', { name: '문자 보내기' }).waitFor();
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

async function runTestSendError(browser) {
  const result = await createNotificationsPage(browser, { width: 390, height: 844 }, 'test-send-error');
  const { context, page } = result;

  await page.goto('/settings/notifications?service=sens&template=attendance', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '출결관리 설정됨' }).click();
  await page.getByLabel('SENS 출결 테스트 전화번호').fill('01055556666');
  await page.getByRole('button', { name: '출결 테스트' }).click();
  const errorMessage = await waitForToast(page, 'error',
    'SENS 출결관리 테스트 발송에 실패했습니다. 사유: 발송 서비스의 보안 설정에서 현재 서버가 허용되지 않았습니다. 알림톡 연동 서비스의 접속 허용 설정을 확인해주세요.'
  );
  await errorMessage.scrollIntoViewIfNeeded();
  if (result.state.testErrorAuthHeader !== 'Bearer smoke-token') {
    throw new Error('notification test request did not include the auth header');
  }
  if (await page.getByText(/Send Failed|192\.0\.2\.1/).count()) {
    throw new Error('notification test error exposed a raw provider status or server address');
  }
  await assertNoRawVisibleText(page, 'notifications test send error');
  await assertNoHorizontalOverflow(page, 'notifications test send error');
  await page.screenshot({ path: '/Users/etlab/paca-notifications-test-error-mobile.png', fullPage: true });

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
    const attendanceDeepLink = await runAttendanceDeepLink(browser);
    const loadError = await runLoadError(browser);
    const testSendError = await runTestSendError(browser);
    [desktop, mobile, attendanceDeepLink, loadError, testSendError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      attendanceDeepLinkPayload: attendanceDeepLink.state.solapiAttendancePayload,
      desktopHits: desktop.state.hits,
      deletedSenderId: desktop.state.deletedSenderId,
      errorHits: loadError.state.hits,
      mobileHits: mobile.state.hits,
      sensAttendancePayload: desktop.state.sensAttendancePayload,
      solapiAttendancePayload: desktop.state.solapiAttendancePayload,
      unpaidPayload: desktop.state.unpaidPayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
