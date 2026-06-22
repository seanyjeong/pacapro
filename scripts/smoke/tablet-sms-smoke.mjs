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

function makeLog() {
  return {
    id: 901,
    academy_id: 1,
    student_id: 41,
    recipient_name: '김진우 학부모',
    recipient_phone: '010-3333-4444',
    message_type: 'SMS',
    message_content: '오늘 수업 안내 문자입니다.',
    status: 'sent',
    error_message: null,
    request_id: 'sms-901',
    sent_at: '2026-06-22T10:00:00.000Z',
    created_at: '2026-06-22T10:00:00.000Z',
  };
}

function makeState(mode = 'success') {
  return { hits: [], mode, sendPayload: null };
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

    if (method === 'GET' && path === '/notifications/settings') {
      return jsonRoute(route, { settings: { service_type: 'sens' } });
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

async function createTabletSmsPage(browser, mode, viewport) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function runPrefilledStudent(browser) {
  const result = await createTabletSmsPage(browser, 'success', { width: 1180, height: 820 });
  const { context, page, state } = result;

  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/tablet/sms?studentId=41&recipient=parent', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '김진우 문자 보내기' }).waitFor();
  const detailLink = page.getByRole('link', { name: '김진우 학생 상세' });
  await detailLink.waitFor();
  if ((await detailLink.getAttribute('href')) !== '/tablet/students/41') {
    throw new Error(`student detail href mismatch: ${await detailLink.getAttribute('href')}`);
  }
  await page.getByRole('heading', { name: '김진우', exact: true }).waitFor();
  await page.getByText('학생 010-1111-2222 · 학부모 010-3333-4444').waitFor();
  await page.getByRole('button', { name: /학부모에게/ }).waitFor();
  await page.getByLabel('발신번호').selectOption('7');
  await page.getByPlaceholder(/내용을 입력해주세요/).fill('오늘 상담 후속 안내입니다.');
  await page.getByRole('button', { name: 'SMS 발송' }).click();
  await page.getByText('문자를 발송했습니다.').waitFor();

  if (state.sendPayload?.target !== 'custom') {
    throw new Error(`tablet SMS target mismatch: ${JSON.stringify(state.sendPayload)}`);
  }
  if (state.sendPayload?.customPhones?.[0] !== '010-3333-4444') {
    throw new Error(`tablet SMS phone mismatch: ${JSON.stringify(state.sendPayload)}`);
  }
  if (state.sendPayload?.senderNumberId !== 7) {
    throw new Error(`tablet SMS sender mismatch: ${JSON.stringify(state.sendPayload)}`);
  }

  await assertNoRawVisibleText(page, 'tablet sms prefilled student');
  await assertNoHorizontalOverflow(page, 'tablet sms prefilled student');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-sms-student.png', fullPage: true });

  await context.close();
  return result;
}

async function runPortrait(browser) {
  const result = await createTabletSmsPage(browser, 'success', { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/sms', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '문자 보내기' }).waitFor();
  await page.getByRole('button', { name: /전체 발송/ }).waitFor();
  await page.getByRole('button', { name: /학부모에게 7명/ }).waitFor();
  await page.getByLabel('발신번호').waitFor();
  await page.getByText('김진우 학부모').waitFor();
  await page.getByText('최근 발송 내역').waitFor();
  await assertNoRawVisibleText(page, 'tablet sms portrait');
  await assertNoHorizontalOverflow(page, 'tablet sms portrait');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-sms-portrait.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createTabletSmsPage(browser, 'load-error', { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/sms', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '문자 준비 정보를 일부 불러오지 못했습니다' }).waitFor();
  const errorBanner = page.locator('section').filter({ hasText: '문자 준비 정보를 일부 불러오지 못했습니다' }).first();
  await errorBanner.getByRole('listitem').filter({ hasText: '문자 수신자 수를 불러오지 못했습니다' }).waitFor();
  await errorBanner.getByRole('listitem').filter({ hasText: '발신번호 정보를 불러오지 못했습니다' }).waitFor();
  await errorBanner.getByRole('listitem').filter({ hasText: '발송 내역을 불러오지 못했습니다' }).waitFor();
  await page.getByText('발송 내역을 불러오지 못했습니다', { exact: true }).waitFor();
  await assertNoRawVisibleText(page, 'tablet sms load error');
  await assertNoHorizontalOverflow(page, 'tablet sms load error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-sms-load-error.png', fullPage: true });

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
    const prefilled = await runPrefilledStudent(browser);
    const portrait = await runPortrait(browser);
    const loadError = await runLoadError(browser);
    [prefilled, portrait, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      loadErrorHits: loadError.state.hits,
      portraitHits: portrait.state.hits,
      prefilledHits: prefilled.state.hits,
      prefilledPayload: prefilled.state.sendPayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
