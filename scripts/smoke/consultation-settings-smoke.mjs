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
    blockedPayload: null,
    hits: [],
    mode,
    settingsPayload: null,
    weeklyPayload: null,
  };
}

function settingsResponse(mode = 'success') {
  const missingHours = mode === 'missing-hours';

  return {
    academy: { id: 1, name: missingHours ? 'PACA 강남' : 'PACA 일산', slug: missingHours ? 'paca-gangnam' : 'paca-ilsan' },
    settings: {
      isEnabled: true,
      pageTitle: 'PACA 상담 예약',
      pageDescription: '방문 전 학생 상황을 남겨주세요.',
      slotDuration: 30,
      maxReservationsPerSlot: 1,
      advanceDays: 30,
      minAdvanceHours: 4,
      referralSources: ['블로그', '지인 소개', 'SNS'],
      sendConfirmationAlimtalk: true,
    },
    weeklyHours: missingHours ? [] : [
      { dayOfWeek: 0, isAvailable: false, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 1, isAvailable: true, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 2, isAvailable: true, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 3, isAvailable: true, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 4, isAvailable: true, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 5, isAvailable: true, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 6, isAvailable: false, startTime: '09:00:00', endTime: '18:00:00' },
    ],
    blockedSlots: [
      {
        id: 7,
        blocked_date: '2026-09-25',
        is_all_day: true,
        reason: '추석',
        created_at: '2026-06-22T09:00:00.000Z',
      },
    ],
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

    if (method === 'GET' && path === '/consultations/settings/info') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, settingsResponse(state.mode));
    }

    if (method === 'GET' && path === '/public/check-slug/paca-gangnam') {
      return jsonRoute(route, { available: true });
    }

    if (method === 'PUT' && path === '/consultations/settings/info') {
      state.settingsPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'saved' });
    }

    if (method === 'PUT' && path === '/consultations/settings/weekly-hours') {
      state.weeklyPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'saved' });
    }

    if (method === 'POST' && path === '/consultations/settings/blocked-slots') {
      state.blockedPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'created', id: 99 });
    }

    if (method === 'DELETE' && path.startsWith('/consultations/settings/blocked-slots/')) {
      return jsonRoute(route, { message: 'removed' });
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

async function runDesktop(browser) {
  const result = await createSettingsPage(browser);
  const { context, page } = result;

  await page.goto('/consultations/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 예약 설정' }).waitFor();
  await waitForSettingsShell(page);
  await page.getByText('PACA 일산').waitFor();
  await page.getByRole('heading', { name: '예약 링크' }).waitFor();
  await page.getByRole('heading', { name: '요일별 운영 시간' }).waitFor();
  await page.getByText('추석').waitFor();
  await assertNoRawVisibleText(page, 'consultation settings desktop');
  await assertNoHorizontalOverflow(page, 'consultation settings desktop');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-settings-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobile(browser) {
  const result = await createSettingsPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/consultations/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 예약 설정' }).waitFor();
  await waitForSettingsShell(page);
  await page.getByRole('heading', { name: '예약 정책' }).waitFor();
  await assertNoRawVisibleText(page, 'consultation settings mobile');
  await assertNoHorizontalOverflow(page, 'consultation settings mobile');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-settings-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runSaveFlows(browser) {
  const result = await createSettingsPage(browser);
  const { context, page, state } = result;

  await page.goto('/consultations/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 예약 설정' }).waitFor();
  await waitForSettingsShell(page);
  await page.getByLabel('페이지 제목').fill('강남 상담 예약');
  await page.getByRole('button', { name: '예약 정책 저장' }).click();
  await page.getByText('설정이 저장되었습니다.').waitFor();

  await page.getByRole('button', { name: '평일만 적용' }).click();
  await page.getByRole('button', { name: '운영 시간 저장' }).click();
  await page.getByText('운영 시간이 저장되었습니다.').waitFor();

  await page.getByRole('button', { name: '날짜 추가' }).click();
  await page.getByLabel('날짜').fill('2026-10-03');
  await page.getByLabel('사유').fill('개천절');
  await page.getByRole('button', { name: '추가' }).last().click();
  await page.getByText('날짜가 차단되었습니다.').waitFor();

  if (state.settingsPayload?.pageTitle !== '강남 상담 예약') {
    throw new Error(`settings payload mismatch: ${JSON.stringify(state.settingsPayload)}`);
  }
  if (!Array.isArray(state.weeklyPayload?.weeklyHours) || state.weeklyPayload.weeklyHours.length !== 7) {
    throw new Error(`weekly payload mismatch: ${JSON.stringify(state.weeklyPayload)}`);
  }
  if (state.blockedPayload?.blockedDate !== '2026-10-03') {
    throw new Error(`blocked payload mismatch: ${JSON.stringify(state.blockedPayload)}`);
  }

  await assertNoRawVisibleText(page, 'consultation settings save flows');
  await assertNoHorizontalOverflow(page, 'consultation settings save flows');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-settings-save.png', fullPage: true });

  await context.close();
  return result;
}

async function runMissingHours(browser) {
  const result = await createSettingsPage(browser, 'missing-hours', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/consultations/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 예약 설정' }).waitFor();
  await waitForSettingsShell(page);
  await page.getByText('PACA 강남').waitFor();
  const board = page.getByTestId('consultation-settings-operations-board');
  await board.getByText('상담 시간 저장 필요').waitFor();
  await board.getByText('저장된 운영 요일').first().waitFor();
  await board.getByText('0일').first().waitFor();
  await assertNoRawVisibleText(page, 'consultation settings missing hours');
  await assertNoHorizontalOverflow(page, 'consultation settings missing hours');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-settings-missing-hours-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createSettingsPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/consultations/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 예약 설정을 불러오지 못했습니다' }).waitFor();
  await page.getByText('잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'consultation settings load error');
  await assertNoHorizontalOverflow(page, 'consultation settings load error');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-settings-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function waitForSettingsShell(page) {
  await page.getByTestId('consultation-settings-operations-workspace').waitFor();
  const board = page.getByTestId('consultation-settings-operations-board');
  await board.waitFor();
  await board.getByText('상담 설정 운영 보드').waitFor();
  await board.getByText('예약 공개', { exact: true }).waitFor();
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
    const saveFlows = await runSaveFlows(browser);
    const missingHours = await runMissingHours(browser);
    const loadError = await runLoadError(browser);
    [desktop, mobile, saveFlows, missingHours, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      errorHits: loadError.state.hits,
      missingHoursHits: missingHours.state.hits,
      savePayload: saveFlows.state.settingsPayload,
      weeklyPayload: saveFlows.state.weeklyPayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
