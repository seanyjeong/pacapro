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

const BASE_USERS = [
  {
    id: 501,
    email: 'waiting-owner@example.com',
    name: '김대기',
    phone: '010-1111-2222',
    role: 'owner',
    approval_status: 'pending',
    created_at: '2026-06-20T09:00:00.000Z',
    academy_name: 'PACA 강남',
  },
  {
    id: 502,
    email: 'coach-waiting@example.com',
    name: '박승인',
    phone: '010-3333-4444',
    role: 'instructor',
    approval_status: 'pending',
    created_at: '2026-06-21T11:30:00.000Z',
    academy_name: 'PACA 일산',
  },
];

function makeState(mode) {
  return {
    approvedUser: null,
    hits: [],
    mode,
    pendingUsers: BASE_USERS.map((user) => ({ ...user })),
    rejectedUser: null,
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

    if (method === 'GET' && path === '/users/pending') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'ok', users: state.pendingUsers });
    }

    if (method === 'POST' && path === '/users/approve/501') {
      if (state.mode === 'approve-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      state.approvedUser = 501;
      state.pendingUsers = state.pendingUsers.filter((user) => user.id !== 501);
      return jsonRoute(route, { message: 'approved', user: BASE_USERS[0] });
    }

    if (method === 'POST' && path === '/users/reject/501') {
      state.rejectedUser = 501;
      state.pendingUsers = state.pendingUsers.filter((user) => user.id !== 501);
      return jsonRoute(route, { message: 'rejected', user: BASE_USERS[0] });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createContext(browser, viewport, userOverride = null) {
  if (!userOverride) return createAuthedContext(browser, viewport);

  const context = await browser.newContext({ viewport, baseURL: DEFAULT_BASE_URL, serviceWorkers: 'block' });
  const hostname = new URL(DEFAULT_BASE_URL).hostname;
  await context.addCookies([{ name: 'paca_auth', value: '1', domain: hostname, path: '/' }]);
  await context.addInitScript((user) => {
    window.localStorage.setItem('token', 'smoke-token');
    window.localStorage.setItem('user', JSON.stringify(user));
  }, userOverride);
  return context;
}

async function createAdminUsersPage(browser, mode, viewport = { width: 1365, height: 900 }, userOverride = null) {
  const state = makeState(mode);
  const context = await createContext(browser, viewport, userOverride);
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

async function runApproveDesktop(browser) {
  const result = await createAdminUsersPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '사용자 승인 관리' }).waitFor();
  await page.getByText('김대기').waitFor();
  await page.getByText('PACA 강남').waitFor();
  await assertNoRawVisibleText(page, 'admin users desktop');
  await assertNoHorizontalOverflow(page, 'admin users desktop');
  await page.screenshot({ path: '/Users/etlab/paca-admin-users-desktop.png', fullPage: true });

  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '승인' }).first(), 'admin user approve');
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('heading', { name: '사용자 승인' }).waitFor();
  await dialog.getByText('김대기').waitFor();
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && normalizePacaApiPath(url) === '/users/approve/501';
    }),
    dialog.getByRole('button', { name: '승인' }).click(),
  ]);
  if (state.approvedUser !== 501) throw new Error('approve API was not called');
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText('김대기').waitFor({ state: 'hidden' });

  await context.close();
  return result;
}

async function runRejectMobile(browser) {
  const result = await createAdminUsersPage(browser, 'success', { width: 390, height: 844 });
  const { context, page, state } = result;

  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '사용자 승인 관리' }).waitFor();
  await page.getByText('김대기').waitFor();
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '거절' }).first(), 'admin user reject');
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('heading', { name: '사용자 거절' }).waitFor();
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && normalizePacaApiPath(url) === '/users/reject/501';
    }),
    dialog.getByRole('button', { name: '거절' }).click(),
  ]);
  if (state.rejectedUser !== 501) throw new Error('reject API was not called');
  await dialog.waitFor({ state: 'hidden' });
  await assertNoRawVisibleText(page, 'admin users reject mobile');
  await assertNoHorizontalOverflow(page, 'admin users reject mobile');
  await page.screenshot({ path: '/Users/etlab/paca-admin-users-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createAdminUsersPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '사용자 승인 관리' }).waitFor();
  await page.getByRole('heading', { name: '사용자 목록을 불러오지 못했습니다' }).waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
  await assertNoRawVisibleText(page, 'admin users load error');
  await assertNoHorizontalOverflow(page, 'admin users load error');
  await page.screenshot({ path: '/Users/etlab/paca-admin-users-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runApproveError(browser) {
  const result = await createAdminUsersPage(browser, 'approve-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '사용자 승인 관리' }).waitFor();
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '승인' }).first(), 'admin user approve error');
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '승인' }).click();
  await page.getByText('사용자 승인을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'admin users approve error');

  await context.close();
  return result;
}

async function runAccessDenied(browser) {
  const result = await createAdminUsersPage(browser, 'success', { width: 390, height: 844 }, {
    id: 9,
    email: 'staff@example.com',
    name: '직원',
    role: 'staff',
    academy_id: 2,
    academy: { id: 2, name: 'PACA 강남' },
    permissions: {},
  });
  const { context, page } = result;

  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '접근 권한 없음' }).waitFor();
  await page.getByRole('button', { name: '대시보드로 이동' }).waitFor();
  await assertNoRawVisibleText(page, 'admin users access denied');
  await assertNoHorizontalOverflow(page, 'admin users access denied');

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
    const approveDesktop = await runApproveDesktop(browser);
    const rejectMobile = await runRejectMobile(browser);
    const loadError = await runLoadError(browser);
    const approveError = await runApproveError(browser);
    const accessDenied = await runAccessDenied(browser);
    [approveDesktop, rejectMobile, loadError, approveError, accessDenied].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      accessDeniedHits: accessDenied.state.hits,
      approveErrorHits: approveError.state.hits,
      approveHits: approveDesktop.state.hits,
      loadErrorHits: loadError.state.hits,
      rejectHits: rejectMobile.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
