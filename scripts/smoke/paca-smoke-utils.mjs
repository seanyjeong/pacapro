import { chromium } from 'playwright';

export const DEFAULT_BASE_URL = process.env.PACA_SMOKE_BASE_URL || 'http://localhost:3109';
export const DEFAULT_CHROME_PATH = process.env.PACA_SMOKE_CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const RAW_VISIBLE_PATTERN = /(Failed to load|CORS|Axios|stack trace|DB timeout|HTTP\s*(400|401|403|404|500)|status\s*(400|401|403|404|500))/i;

export async function launchSmokeBrowser() {
  return chromium.launch({
    executablePath: DEFAULT_CHROME_PATH,
    headless: process.env.PACA_SMOKE_HEADLESS !== 'false',
  });
}

export async function createAuthedContext(browser, viewport, baseURL = DEFAULT_BASE_URL) {
  const context = await browser.newContext({ viewport, baseURL, serviceWorkers: 'block' });
  await context.addCookies([{ name: 'paca_auth', value: '1', domain: 'localhost', path: '/' }]);
  await context.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token');
    window.localStorage.setItem('user', JSON.stringify({
      id: 1,
      email: 'owner@example.com',
      name: '원장',
      role: 'owner',
      academy_id: 1,
      academy: { id: 1, name: 'PACA 일산' },
      permissions: {},
    }));
  });
  return context;
}

export function normalizePacaApiPath(url) {
  let path = url.pathname;
  if (path.startsWith('/paca')) path = path.slice('/paca'.length) || '/';
  return path;
}

export function jsonRoute(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
}

export function createDiagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

export function nonServiceWorkerErrors(errors) {
  return errors.filter((message) => !/ServiceWorker|service worker|workbox|waiting/i.test(message));
}

export async function assertNoRawVisibleText(page, label) {
  const text = await page.locator('body').innerText();
  if (RAW_VISIBLE_PATTERN.test(text)) {
    throw new Error(`${label} raw technical text leaked: ${text.match(RAW_VISIBLE_PATTERN)?.[0]}`);
  }
}

export async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error(`${label} horizontal overflow ${overflow}px`);
}
