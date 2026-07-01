import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createAuthedContext,
  createDiagnostics,
  isPacaApiRequest,
  jsonRoute,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

const BASE_URL = process.env.PACA_SMOKE_BASE_URL || 'http://localhost:3109';

const dashboardStats = {
  students: { total_students: 38, active_students: '31', paused_students: '4' },
  instructors: { total_instructors: 7, active_instructors: '5' },
  current_month: {
    month: '2026년 6월',
    revenue: { count: 18, amount: 3600000 },
    expenses: { count: 7, amount: 1250000 },
    net_income: 2350000,
  },
  unpaid_payments: { count: 3, amount: 850000 },
  rest_ended_students: { count: 1 },
};

const instructorsBySlot = {
  morning: [{ id: 11, name: '김코치' }],
  afternoon: [{ id: 12, name: '이코치' }],
  evening: [{ id: 13, name: '박코치' }],
};

const consultations = [
  {
    id: 21,
    student_name: '김진우',
    preferred_date: '2026-06-23',
    preferred_time: '15:00',
    status: 'confirmed',
    consultation_type: 'new_registration',
  },
];

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], verifyPayloads: [], ...overrides };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocal = url.origin === BASE_URL;
    const isApi = isPacaApiRequest(url);

    if (!isApi) {
      if (!isLocal) state.externalContinues.push(request.url());
      return route.continue();
    }

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);

    if (state.failDashboard && method === 'GET' && path === '/reports/dashboard') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, { academy: { id: 1, name: 'PACA 일산' } });
    }
    if (method === 'GET' && path === '/reports/dashboard') {
      return jsonRoute(route, dashboardStats);
    }
    if (method === 'GET' && path.includes('/instructor-attendance')) {
      return jsonRoute(route, { date: '2026-06-23', attendances: [], instructors: [], instructors_by_slot: instructorsBySlot });
    }
    if (method === 'GET' && path === '/consultations') {
      return jsonRoute(route, { consultations });
    }
    if (method === 'GET' && path === '/students/rest-ended') {
      return jsonRoute(route, {
        message: 'ok',
        students: [
          {
            id: 41,
            name: '최휴원',
            phone: '010-1111-2222',
            school: '일산고',
            grade: '고2',
            rest_start_date: '2026-05-01',
            rest_end_date: '2026-06-20',
            rest_reason: '부상',
            class_days: [],
            time_slot: 'evening',
            monthly_tuition: '500000',
            discount_rate: '0',
            days_overdue: 3,
          },
        ],
      });
    }
    if (method === 'POST' && path === '/auth/verify-password') {
      state.verifyPayloads.push(JSON.parse(request.postData() || '{}'));
      return jsonRoute(route, { message: 'verified', verified: true });
    }
    if (method === 'POST' && path === '/peak-sso/code') {
      if (state.failPeakSso) {
        return jsonRoute(route, { message: 'PEAK SSO HTTP 500 stack trace' }, 500);
      }
      return jsonRoute(route, { peakUrl: 'https://peak-rose.vercel.app/login?code=smoke', success: true });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function openDashboard(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '오늘의 운영 현황' }).waitFor({ timeout: 10000 });
  await page.getByText('PACA Operations Desk').waitFor();
}

async function assertAmountHidden(page, label) {
  await page.getByText('금액 가림').first().waitFor();
  await page.getByRole('button', { name: /금액 보기/ }).waitFor();
  await page.getByText('비밀번호 확인 필요').waitFor();
  const text = await page.locator('body').innerText();
  if (text.includes('₩3,600,000') || text.includes('₩850,000') || text.includes('235만원')) {
    throw new Error(`${label} exposed protected dashboard amount while hidden`);
  }
}

async function revealAmounts(page, state) {
  await page.getByRole('button', { name: /금액 보기/ }).click();
  await page.getByText('금액 보기 확인').waitFor();
  await page.getByLabel('비밀번호').fill('owner-pass');
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByText('금액 표시 중').waitFor();
  await page.getByText('₩3,600,000').waitFor();
  if (state.verifyPayloads[0]?.password !== 'owner-pass') {
    throw new Error(`verify password payload mismatch: ${JSON.stringify(state.verifyPayloads)}`);
  }
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

async function runDesktopPrivacy(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openDashboard(page);
  const movementAnalysisLink = page.getByRole('link', { name: '동작분석사이트' });
  await movementAnalysisLink.waitFor();
  const movementHref = await movementAnalysisLink.getAttribute('href');
  const movementTarget = await movementAnalysisLink.getAttribute('target');
  if (movementHref !== 'https://www.performetrics.co.kr/' || movementTarget !== '_blank') {
    throw new Error(`movement analysis link mismatch: ${movementHref} / ${movementTarget}`);
  }
  await assertAmountHidden(page, 'dashboard desktop');
  await page.screenshot({ path: '/Users/etlab/paca-dashboard-hidden-desktop.png', fullPage: true });

  await revealAmounts(page, state);
  await page.screenshot({ path: '/Users/etlab/paca-dashboard-visible-desktop.png', fullPage: true });

  await page.getByRole('button', { name: /가리기/ }).click();
  await assertAmountHidden(page, 'dashboard desktop rehiden');
  await assertNoRawVisibleText(page, 'dashboard desktop');
  await assertNoHorizontalOverflow(page, 'dashboard desktop');

  await context.close();
  return { state, diagnostics };
}

async function runPeakSsoFallback(browser) {
  const state = makeState({ failPeakSso: true });
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openDashboard(page);
  const popupPromise = page.waitForEvent('popup');
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: 'P-EAK 실기관리' }), 'peak SSO fallback');
  const popup = await popupPromise;
  if (!popup.url().startsWith('https://peak-rose.vercel.app')) {
    throw new Error(`unexpected peak fallback URL: ${popup.url()}`);
  }
  await page.getByText('피크 자동 로그인을 준비하지 못했습니다. 피크 로그인 화면으로 이동합니다.').waitFor();
  await assertNoRawVisibleText(page, 'peak SSO fallback');
  await assertNoHorizontalOverflow(page, 'peak SSO fallback');
  await page.screenshot({ path: '/Users/etlab/paca-dashboard-peak-sso-fallback.png', fullPage: true });
  await popup.close();

  await context.close();
  return { state, diagnostics };
}

async function runMobilePrivacy(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await openDashboard(page);
  await assertAmountHidden(page, 'dashboard mobile');
  await assertNoRawVisibleText(page, 'dashboard mobile');
  await assertNoHorizontalOverflow(page, 'dashboard mobile');
  await page.screenshot({ path: '/Users/etlab/paca-dashboard-hidden-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failDashboard: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByText('대시보드 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.').waitFor();
  await assertNoRawVisibleText(page, 'dashboard error');
  await assertNoHorizontalOverflow(page, 'dashboard error');
  await page.screenshot({ path: '/Users/etlab/paca-dashboard-error-mobile.png', fullPage: true });

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
    const desktop = await runDesktopPrivacy(browser);
    const peakFallback = await runPeakSsoFallback(browser);
    const mobile = await runMobilePrivacy(browser);
    const loadError = await runLoadError(browser);
    [desktop, peakFallback, mobile, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      peakFallbackHits: peakFallback.state.hits,
      mobileHits: mobile.state.hits,
      loadErrorHits: loadError.state.hits,
      verifyPayloads: desktop.state.verifyPayloads,
      desktopConsoleErrors: desktop.diagnostics.consoleErrors,
      peakFallbackConsoleErrors: peakFallback.diagnostics.consoleErrors,
      mobileConsoleErrors: mobile.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
