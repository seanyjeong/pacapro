import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  DEFAULT_BASE_URL,
  jsonRoute,
  launchSmokeBrowser,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

const AUTH_ERRORS = {
  forgot: '비밀번호 재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.',
  login: '이메일 또는 비밀번호가 맞지 않습니다.',
  register: '회원가입을 완료하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해주세요.',
  reset: '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.',
};

function makeState() {
  return { hits: [] };
}

async function createPublicPage(browser) {
  const state = makeState();
  const context = await browser.newContext({ baseURL: DEFAULT_BASE_URL, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'supermax.kr';
    if (!isApi) return route.continue();
    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);
    if (method === 'GET' && path === '/auth/verify-reset-token') return jsonRoute(route, { valid: true });
    return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { context, page, state };
}

async function assertSafeAuthError(page, state, label, expectedText) {
  try {
    await page.getByRole('alert').getByText(expectedText).waitFor();
  } catch (error) {
    const visibleText = await page.locator('body').innerText().catch(() => '');
    throw new Error(`${label} did not show safe auth error: ${error.message}\nhits=${state.hits.join(' | ')}\ntext=${visibleText}`);
  }
  await assertNoRawVisibleText(page, label);
  await assertNoHorizontalOverflow(page, label);
}

async function runLoginError(browser) {
  const result = await createPublicPage(browser);
  const { context, page } = result;
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: '체대입시 학원관리' }).waitFor();
  await page.getByRole('heading', { name: '로그인' }).waitFor();
  await page.locator('#email').fill('owner@example.com');
  await page.locator('#password').fill('bad-password');
  await page.getByRole('button', { name: '로그인' }).click();
  await assertSafeAuthError(page, result.state, 'login error', AUTH_ERRORS.login);
  await page.screenshot({ path: '/Users/etlab/paca-auth-login-error.png', fullPage: true });
  await context.close();
  return result;
}

async function runRegisterError(browser) {
  const result = await createPublicPage(browser);
  const { context, page } = result;
  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: '체대입시 학원관리' }).waitFor();
  await page.locator('#academyName').fill('PACA 일산');
  await page.locator('#name').fill('원장');
  await page.locator('#email').fill('owner@example.com');
  await page.locator('#phone').fill('010-1111-2222');
  await page.locator('#password').fill('password123');
  await page.locator('#confirmPassword').fill('password123');
  await page.getByRole('button', { name: '회원가입' }).click();
  await assertSafeAuthError(page, result.state, 'register error', AUTH_ERRORS.register);
  await page.screenshot({ path: '/Users/etlab/paca-auth-register-error.png', fullPage: true });
  await context.close();
  return result;
}

async function runForgotError(browser) {
  const result = await createPublicPage(browser);
  const { context, page } = result;
  await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: '체대입시 학원관리' }).waitFor();
  await page.locator('#email').fill('owner@example.com');
  await page.getByRole('button', { name: '재설정 링크 받기' }).click();
  await assertSafeAuthError(page, result.state, 'forgot password error', AUTH_ERRORS.forgot);
  await page.screenshot({ path: '/Users/etlab/paca-auth-forgot-error.png', fullPage: true });
  await context.close();
  return result;
}

async function runResetError(browser) {
  const result = await createPublicPage(browser);
  const { context, page } = result;
  await page.goto('/reset-password?token=valid-token', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: '체대입시 학원관리' }).waitFor();
  await page.getByRole('heading', { name: '새 비밀번호 설정' }).waitFor();
  await page.locator('#newPassword').fill('password123');
  await page.locator('#confirmPassword').fill('password123');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  await assertSafeAuthError(page, result.state, 'reset password error', AUTH_ERRORS.reset);
  await page.screenshot({ path: '/Users/etlab/paca-auth-reset-error.png', fullPage: true });
  await context.close();
  return result;
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const login = await runLoginError(browser);
    const register = await runRegisterError(browser);
    const forgot = await runForgotError(browser);
    const reset = await runResetError(browser);
    console.log(JSON.stringify({ hits: [...login.state.hits, ...register.state.hits, ...forgot.state.hits, ...reset.state.hits] }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
