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

function makeState(mode) {
  return {
    hits: [],
    mode,
    sendPayload: null,
  };
}

function makeLog() {
  return {
    id: 501,
    academy_id: 1,
    student_id: 41,
    recipient_name: '김진우 학부모',
    recipient_phone: '010-3333-4444',
    message_type: 'SMS',
    message_content: '오늘 수업 안내 문자입니다.',
    status: 'sent',
    error_message: null,
    request_id: 'sms-501',
    sent_at: '2026-06-22T10:00:00.000Z',
    created_at: '2026-06-22T10:00:00.000Z',
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
      return jsonRoute(route, { academy: { id: 1, name: 'PACA 일산' } });
    }

    if (method === 'GET' && path === '/consultations') {
      return jsonRoute(route, {
        consultations: [],
        pagination: { total: 0, page: 1, limit: 1, totalPages: 0 },
        stats: { total: 0, pending: 0, confirmed: 0 },
      });
    }

    if (method === 'GET' && path === '/notifications/settings') {
      return jsonRoute(route, { settings: { service_type: 'sens' } });
    }

    if (method === 'GET' && path === '/sms/sender-numbers') {
      if (state.mode === 'load-error' || state.mode === 'sender-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        senderNumbers: [
          { id: 7, service_type: 'sens', phone: '010-2144-6755', label: '대표', is_default: 1, created_at: '2026-06-01T09:00:00.000Z' },
        ],
      });
    }

    if (method === 'GET' && path === '/sms/recipients-count') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { all: 8, students: 5, parents: 7 });
    }

    if (method === 'GET' && path === '/sms/logs') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        logs: [makeLog()],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    }

    if (method === 'GET' && path === '/students') {
      return jsonRoute(route, {
        students: [
          { id: 41, name: '김진우', phone: '010-1111-2222', parent_phone: '010-3333-4444', grade: '고2' },
        ],
      });
    }

    if (method === 'GET' && path === '/students/41') {
      return jsonRoute(route, {
        student: { id: 41, name: '김진우', phone: '010-1111-2222', parent_phone: '010-3333-4444' },
      });
    }

    if (method === 'POST' && path === '/sms/send') {
      state.sendPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: '문자를 발송했습니다.', sent: 1, failed: 0, total: 1 });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createSmsPage(browser, mode, viewport = { width: 1365, height: 900 }) {
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

async function runDesktopSend(browser) {
  const result = await createSmsPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/sms', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '문자 보내기' }).waitFor();
  await page.locator('header').getByText('Messaging Desk').waitFor();
  await assertOperationsBoard(page);
  await page.getByText('김진우 학부모').waitFor();
  const studentLink = page.getByRole('link', { name: '김진우 학부모 학생 상세 보기' });
  await studentLink.waitFor();
  if ((await studentLink.getAttribute('href')) !== '/students/41') {
    throw new Error('missing student detail link in SMS log');
  }
  await page.getByLabel('발신번호').selectOption('7');
  await page.getByRole('button', { name: /학부모에게 7명/ }).waitFor();
  await page.getByPlaceholder(/내용을 입력해주세요/).fill('오늘 수업은 정상 진행됩니다.');
  await clickWithoutNativeDialog(
    page,
    page.getByTestId('sms-operations-board').getByRole('button', { name: 'SMS 발송' }),
    'sms desktop send'
  );
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('heading', { name: '문자 발송 확인' }).waitFor();
  await dialog.getByText('7명에게 SMS를 발송합니다.').waitFor();
  await dialog.getByRole('button', { name: '발송' }).click();
  await page.getByText('문자를 발송했습니다.').waitFor();
  await dialog.waitFor({ state: 'hidden' });

  if (!state.sendPayload) throw new Error('SMS payload was not sent');
  if (state.sendPayload.target !== 'parents') throw new Error(`target mismatch: ${state.sendPayload.target}`);
  if (state.sendPayload.senderNumberId !== 7) {
    throw new Error(`senderNumberId mismatch: ${state.sendPayload.senderNumberId}`);
  }

  await assertNoRawVisibleText(page, 'sms desktop send');
  await assertNoHorizontalOverflow(page, 'sms desktop send');
  await page.screenshot({ path: '/Users/etlab/paca-sms-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runPrefilledStudent(browser) {
  const result = await createSmsPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/sms?studentId=41&recipient=parent', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '문자 보내기' }).waitFor();
  await page.getByRole('heading', { name: '김진우' }).waitFor();
  await page.getByText('학생 010-1111-2222 · 학부모 010-3333-4444').waitFor();
  await page.getByRole('button', { name: /학부모에게/ }).waitFor();
  await page.getByLabel('발신번호').selectOption('7');
  await page.getByPlaceholder(/내용을 입력해주세요/).fill('오늘 상담 후속 안내입니다.');
  await clickWithoutNativeDialog(
    page,
    page.getByTestId('sms-operations-board').getByRole('button', { name: 'SMS 발송' }),
    'sms prefilled student send'
  );
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('heading', { name: '문자 발송 확인' }).waitFor();
  await dialog.getByText('1명에게 SMS를 발송합니다.').waitFor();
  await dialog.getByRole('button', { name: '발송' }).click();
  await page.getByText('문자를 발송했습니다.').waitFor();
  await dialog.waitFor({ state: 'hidden' });

  if (state.sendPayload?.target !== 'custom') {
    throw new Error(`prefilled SMS target mismatch: ${JSON.stringify(state.sendPayload)}`);
  }
  if (state.sendPayload?.customPhones?.[0] !== '010-3333-4444') {
    throw new Error(`prefilled SMS phone mismatch: ${JSON.stringify(state.sendPayload)}`);
  }

  await assertNoRawVisibleText(page, 'sms prefilled student');
  await assertNoHorizontalOverflow(page, 'sms prefilled student');
  await page.screenshot({ path: '/Users/etlab/paca-sms-prefilled-student.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobile(browser) {
  const result = await createSmsPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/sms', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '문자 보내기' }).waitFor();
  await page.locator('header').getByText('Messaging Desk').waitFor();
  await assertOperationsBoard(page);
  await page.getByTestId('sms-operations-board').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/Users/etlab/paca-sms-mobile-board.png', fullPage: false });
  await page.getByRole('button', { name: /학부모에게 7명/ }).waitFor();
  await page.getByRole('link', { name: '김진우 학부모 학생 상세 보기' }).waitFor();
  await assertNoRawVisibleText(page, 'sms mobile');
  await assertNoHorizontalOverflow(page, 'sms mobile');
  await page.screenshot({ path: '/Users/etlab/paca-sms-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createSmsPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/sms', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '문자 준비 정보를 일부 불러오지 못했습니다' }).waitFor();
  const errorBanner = page.locator('section').filter({ hasText: '문자 준비 정보를 일부 불러오지 못했습니다' }).first();
  await errorBanner.getByRole('listitem').filter({ hasText: '문자 수신자 수를 불러오지 못했습니다' }).waitFor();
  await errorBanner.getByRole('listitem').filter({ hasText: '발신번호 정보를 불러오지 못했습니다' }).waitFor();
  await errorBanner.getByRole('listitem').filter({ hasText: '발송 내역을 불러오지 못했습니다' }).waitFor();
  await assertNoRawVisibleText(page, 'sms load error');
  await assertNoHorizontalOverflow(page, 'sms load error');
  await page.screenshot({ path: '/Users/etlab/paca-sms-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runMissingSenderPreventsSend(browser) {
  const result = await createSmsPage(browser, 'sender-error');
  const { context, page, state } = result;

  await page.goto('/sms', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '문자 보내기' }).waitFor();
  await page.getByRole('heading', { name: '문자 준비 정보를 일부 불러오지 못했습니다' }).waitFor();
  await page.getByPlaceholder(/내용을 입력해주세요/).fill('발신번호가 없으면 발송하지 않습니다.');
  const sendButton = page.getByTestId('sms-operations-board').getByRole('button', { name: 'SMS 발송' });
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.includes('SMS 발송'));
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await clickWithoutNativeDialog(page, sendButton, 'sms missing sender send');
  await page.getByText('발신번호를 선택해주세요. 설정에서 발신번호를 확인한 뒤 다시 시도해주세요.').waitFor();
  if (await page.getByRole('alertdialog').isVisible().catch(() => false)) {
    throw new Error('SMS confirmation dialog opened without a sender number');
  }
  if (state.sendPayload) throw new Error(`SMS was sent without a sender number: ${JSON.stringify(state.sendPayload)}`);

  await assertNoRawVisibleText(page, 'sms missing sender');
  await assertNoHorizontalOverflow(page, 'sms missing sender');

  await context.close();
  return result;
}

async function assertOperationsBoard(page) {
  const board = page.getByTestId('sms-operations-board');
  await board.getByRole('heading', { name: '문자 작업 보드' }).waitFor();
  await board.getByTestId('sms-board-metric-type').getByText('SMS').waitFor();
  await board.getByTestId('sms-board-metric-recipients').getByText('7명').waitFor();
  await board.getByTestId('sms-board-metric-senders').getByText('1개').waitFor();
  await board.getByRole('button', { name: '전체' }).waitFor();
  await board.getByRole('button', { name: '개별' }).waitFor();
  await board.getByRole('button', { name: '직접' }).waitFor();
  const composeLink = board.getByRole('link', { name: '문자 작성으로 이동' });
  await composeLink.waitFor();
  if ((await composeLink.getAttribute('href')) !== '#sms-compose') {
    throw new Error('SMS compose quick link mismatch');
  }
  const logsLink = board.getByRole('link', { name: '발송 내역으로 이동' });
  await logsLink.waitFor();
  if ((await logsLink.getAttribute('href')) !== '#sms-logs') {
    throw new Error('SMS logs quick link mismatch');
  }
  await board.getByRole('link', { name: '알림톡 및 SMS 설정' }).waitFor();
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const desktop = await runDesktopSend(browser);
    const prefilled = await runPrefilledStudent(browser);
    const mobile = await runMobile(browser);
    const loadError = await runLoadError(browser);
    const missingSender = await runMissingSenderPreventsSend(browser);
    [desktop, prefilled, mobile, loadError, missingSender].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      errorConsoleErrors: loadError.diagnostics.consoleErrors,
      errorHits: loadError.state.hits,
      missingSenderHits: missingSender.state.hits,
      mobileHits: mobile.state.hits,
      prefilledHits: prefilled.state.hits,
      prefilledPayload: prefilled.state.sendPayload,
      sendPayload: desktop.state.sendPayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
