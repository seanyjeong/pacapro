import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

export const DEFAULT_BASE_URL = process.env.PACA_SMOKE_BASE_URL || 'http://localhost:3109';
export const DEFAULT_CHROME_PATH = process.env.PACA_SMOKE_CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_APP_VERSION = process.env.PACA_SMOKE_APP_VERSION || packageJson.version;

const RAW_VISIBLE_PATTERN = /(ENC:|Failed to load|CORS|Axios|stack trace|DB timeout|HTTP\s*(400|401|403|404|500)|status\s*(400|401|403|404|500))/i;

export async function launchSmokeBrowser() {
  const browser = await chromium.launch({
    executablePath: DEFAULT_CHROME_PATH,
    headless: process.env.PACA_SMOKE_HEADLESS !== 'false',
  });
  const originalClose = browser.close.bind(browser);
  const browserProcess = browser.process?.();

  browser.close = async (...args) => {
    const timeoutMs = Number(process.env.PACA_SMOKE_CLOSE_TIMEOUT_MS || 3000);
    let timeout;
    try {
      await Promise.race([
        originalClose(...args),
        new Promise((resolve) => {
          timeout = setTimeout(resolve, timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
      if (browserProcess && !browserProcess.killed) browserProcess.kill('SIGTERM');
    }
  };

  return browser;
}

export async function createAuthedContext(browser, viewport, baseURL = DEFAULT_BASE_URL) {
  const context = await browser.newContext({ viewport, baseURL, serviceWorkers: 'block' });
  const authCookieUrl = new URL('/', baseURL).origin;
  await context.addCookies([{ name: 'paca_auth', value: '1', url: authCookieUrl }]);
  await context.addInitScript((appVersion) => {
    window.localStorage.setItem('token', 'smoke-token');
    window.localStorage.setItem('app_version', appVersion);
    window.sessionStorage.setItem('version_reload_attempt', appVersion);
    window.localStorage.setItem('user', JSON.stringify({
      id: 1,
      email: 'owner@example.com',
      name: '원장',
      role: 'owner',
      academy_id: 1,
      academy: { id: 1, name: 'PACA 일산' },
      permissions: {},
    }));
  }, DEFAULT_APP_VERSION);
  return context;
}

export async function installFakeAttendanceSocket(context) {
  await context.addInitScript(() => {
    const sockets = [];

    class SmokeWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        super();
        this.url = url;
        this.readyState = SmokeWebSocket.OPEN;
        sockets.push(this);
        setTimeout(() => this.dispatchEvent(new Event('open')), 0);
      }

      send(data) {
        this.lastSent = data;
      }

      close() {
        this.readyState = SmokeWebSocket.CLOSED;
        this.dispatchEvent(new CloseEvent('close'));
      }
    }

    window.WebSocket = SmokeWebSocket;
    window.__emitPacaAttendanceUpdate = (scheduleId) => {
      sockets.forEach((socket) => {
        socket.dispatchEvent(new MessageEvent('message', {
          data: JSON.stringify({ type: 'attendance-updated', schedule_id: scheduleId }),
        }));
      });
    };
  });
}

export function isPacaApiRequest(url, baseURL = DEFAULT_BASE_URL) {
  const baseOrigin = new URL(baseURL).origin;
  return url.hostname === 'supermax.kr' || (
    url.origin === baseOrigin && url.pathname.startsWith('/paca')
  );
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
