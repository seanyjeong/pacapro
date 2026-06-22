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

function makeState(mode = 'success') {
  return {
    hits: [],
    mode,
    notificationPayload: null,
  };
}

function notificationSettings(overrides = {}) {
  return {
    unpaid_attendance: true,
    consultation_reminder: true,
    new_consultation: true,
    pause_ending: false,
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
    state.hits.push(`${method} ${path}`);

    if (method === 'GET' && path === '/auth/me') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        user: {
          id: 1,
          email: 'owner@example.com',
          name: '원장',
          role: 'owner',
          academy_name: 'PACA 일산',
        },
      });
    }

    if (method === 'GET' && path === '/notification-settings') {
      return jsonRoute(route, { settings: notificationSettings() });
    }

    if (method === 'PUT' && path === '/notification-settings') {
      state.notificationPayload = JSON.parse(request.postData() || '{}');
      if (state.mode === 'save-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'saved', settings: notificationSettings(state.notificationPayload) });
    }

    if (method === 'POST' && path === '/auth/logout') {
      return jsonRoute(route, { message: 'logged out' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createTabletSettingsPage(browser, mode, viewport) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function runNormal(browser, viewport, label) {
  const result = await createTabletSettingsPage(browser, 'success', viewport);
  const { context, page } = result;

  await page.goto('/tablet/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '태블릿 운영 설정' }).waitFor();
  await page.getByText('owner@example.com').waitFor();
  await page.getByText('PACA 일산').waitFor();
  await page.getByRole('link', { name: '상담예약 설정' }).waitFor();
  await page.getByRole('link', { name: '학원 운영 설정' }).waitFor();
  await page.getByRole('link', { name: '수업일관리' }).waitFor();
  await page.getByRole('button', { name: '새 상담 예약 알림 끄기' }).waitFor();

  const consultationHref = await page.getByRole('link', { name: '상담예약 설정' }).getAttribute('href');
  if (consultationHref !== '/consultations/settings') {
    throw new Error(`consultation settings href mismatch: ${consultationHref}`);
  }

  await assertNoRawVisibleText(page, `tablet settings ${label}`);
  await assertNoHorizontalOverflow(page, `tablet settings ${label}`);
  await page.screenshot({ path: `/Users/etlab/paca-tablet-settings-${label}.png`, fullPage: true });

  await context.close();
  return result;
}

async function runNotificationSave(browser) {
  const result = await createTabletSettingsPage(browser, 'success', { width: 1180, height: 820 });
  const { context, page, state } = result;

  await page.goto('/tablet/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '태블릿 운영 설정' }).waitFor();
  await page.getByRole('button', { name: '새 상담 예약 알림 끄기' }).click();
  await page.getByText('알림 설정이 저장되었습니다.').waitFor();

  if (state.notificationPayload?.new_consultation !== false) {
    throw new Error(`notification payload mismatch: ${JSON.stringify(state.notificationPayload)}`);
  }

  await assertNoRawVisibleText(page, 'tablet settings notification save');
  await assertNoHorizontalOverflow(page, 'tablet settings notification save');

  await context.close();
  return result;
}

async function runNotificationError(browser) {
  const result = await createTabletSettingsPage(browser, 'save-error', { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '태블릿 운영 설정' }).waitFor();
  await page.getByRole('button', { name: '새 상담 예약 알림 끄기' }).click();
  await page.getByText('알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'tablet settings notification error');
  await assertNoHorizontalOverflow(page, 'tablet settings notification error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-settings-notification-error.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createTabletSettingsPage(browser, 'load-error', { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '설정 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByText('잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'tablet settings load error');
  await assertNoHorizontalOverflow(page, 'tablet settings load error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-settings-load-error.png', fullPage: true });

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
    const landscape = await runNormal(browser, { width: 1180, height: 820 }, 'landscape');
    const portrait = await runNormal(browser, { width: 820, height: 1180 }, 'portrait');
    const notificationSave = await runNotificationSave(browser);
    const notificationError = await runNotificationError(browser);
    const loadError = await runLoadError(browser);
    [landscape, portrait, notificationSave, notificationError, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      landscapeHits: landscape.state.hits,
      loadErrorHits: loadError.state.hits,
      notificationPayload: notificationSave.state.notificationPayload,
      portraitHits: portrait.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
