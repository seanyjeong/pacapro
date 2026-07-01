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

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], ...overrides };
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

    if (method === 'GET' && path === '/notification-settings') {
      return jsonRoute(route, {
        settings: {
          unpaid_attendance: true,
          consultation_reminder: false,
          new_consultation: true,
          pause_ending: true,
        },
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createMobilePage(browser, state, userOverride = null) {
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  if (userOverride) {
    await context.addInitScript((user) => {
      window.localStorage.setItem('user', JSON.stringify(user));
    }, userOverride);
  }
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  return { context, page, diagnostics };
}

async function gotoWorkspace(page) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto('/m', { waitUntil: 'domcontentloaded' });
    try {
      await page.getByTestId('mobile-home-workspace').waitFor({ timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return;
    } catch (error) {
      if (attempt === 2) {
        const body = await page.locator('body').innerText().catch(() => '');
        throw new Error(`mobile home workspace did not render at ${page.url()}: ${body.slice(0, 500)}\n${error.message}`);
      }
      await page.waitForTimeout(500);
    }
  }
}

async function runOwnerHome(browser) {
  const state = makeState();
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await page.getByRole('heading', { name: 'PACA 일산' }).waitFor();
  await page.getByText('원장님 안녕하세요').waitFor();
  const operationsPanel = page.getByTestId('mobile-home-operations-panel');
  await operationsPanel.getByRole('heading', { name: '오늘 작업' }).waitFor();
  await operationsPanel.getByText('4개 업무').waitFor();
  await operationsPanel.getByText('원장 계정').waitFor();

  const expectedLinks = [
    ['학생 출석체크', '/m/attendance'],
    ['강사 출근체크', '/m/instructor'],
    ['미납자 확인', '/m/unpaid'],
    ['오늘 상담', '/m/consultations'],
  ];
  for (const [name, href] of expectedLinks) {
    const link = page.getByRole('link', { name: new RegExp(name) });
    await link.waitFor();
    const actualHref = await link.getAttribute('href');
    if (actualHref !== href) throw new Error(`menu href mismatch ${name}: ${actualHref}`);
  }

  await assertNoRawVisibleText(page, 'mobile home owner');
  await assertNoHorizontalOverflow(page, 'mobile home owner');
  await page.screenshot({ path: '/Users/etlab/paca-mobile-home.png', fullPage: true });

  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL('**/login');
  const token = await page.evaluate(() => window.localStorage.getItem('token'));
  if (token !== null) throw new Error('logout did not clear token');

  await context.close();
  return { state, diagnostics };
}

async function runPermissionFilter(browser) {
  const state = makeState();
  const user = {
    id: 2,
    email: 'staff@example.com',
    name: '데스크',
    role: 'staff',
    academy_id: 1,
    academy: { id: 1, name: 'PACA 일산' },
    permissions: {
      schedules: { view: true, edit: true },
      payments: { view: false, edit: false },
      consultations: { view: false, edit: false },
    },
  };
  const { context, page, diagnostics } = await createMobilePage(browser, state, user);

  await gotoWorkspace(page);
  await page.getByRole('link', { name: /학생 출석체크/ }).waitFor();
  await page.getByRole('link', { name: /강사 출근체크/ }).waitFor();
  await page.getByTestId('mobile-home-operations-panel').getByText('2개 업무').waitFor();
  if (await page.getByRole('link', { name: /미납자 확인/ }).count()) {
    throw new Error('payments menu should be hidden for staff without payments.view');
  }
  if (await page.getByRole('link', { name: /오늘 상담/ }).count()) {
    throw new Error('consultations menu should be hidden without consultations.view');
  }

  await assertNoRawVisibleText(page, 'mobile home permission filter');
  await assertNoHorizontalOverflow(page, 'mobile home permission filter');
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
    const owner = await runOwnerHome(browser);
    const filtered = await runPermissionFilter(browser);
    [owner, filtered].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      ownerHits: owner.state.hits,
      filteredHits: filtered.state.hits,
      ownerConsoleErrors: owner.diagnostics.consoleErrors,
      filteredConsoleErrors: filtered.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
