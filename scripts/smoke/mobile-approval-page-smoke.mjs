import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const PAGE_URL = pathToFileURL(path.join(ROOT, 'ops/paca-approval-mobile/index.html')).href;

function jsonRoute(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });
}

async function createPage(loginStatus = 200) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      if (message.text().includes('Failed to load resource')) return;
      errors.push(message.text());
    }
  });

  await page.route('https://supermax.kr/paca/auth/login', (route) => {
    if (loginStatus !== 200) {
      return jsonRoute(route, { message: 'Unauthorized' }, loginStatus);
    }
    return jsonRoute(route, { token: 'smoke-token', user: { role: 'system_admin' } });
  });
  await page.route('https://supermax.kr/paca/users/pending', (route) => {
    return jsonRoute(route, {
      users: [
        {
          id: 101,
          name: '김원장',
          email: 'owner@example.com',
          phone: '010-0000-0000',
          academy_name: 'PACA 테스트',
          created_at: '2026-07-02T04:00:00.000Z'
        },
        {
          id: 102,
          name: '이원장',
          email: 'owner2@example.com',
          phone: '',
          academy_name: 'PACA 분원',
          created_at: '2026-07-02T04:03:00.000Z'
        }
      ]
    });
  });
  await page.route('https://supermax.kr/paca/users/approve/101', (route) => {
    return jsonRoute(route, { message: 'ok' });
  });

  return { browser, page, errors };
}

async function assertNoRawErrorWords(page) {
  const text = await page.locator('body').innerText();
  const forbidden = ['Unauthorized', 'Forbidden', 'Internal Server Error', 'CORS', 'stack', '500', '401', '403'];
  for (const word of forbidden) {
    if (text.includes(word)) {
      throw new Error(`raw error word leaked: ${word}`);
    }
  }
}

async function runSuccessFlow() {
  const { browser, page, errors } = await createPage();
  try {
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(PAGE_URL);
    await page.getByRole('heading', { name: '가입 승인' }).waitFor();
    await page.getByLabel('관리자 이메일').fill('admin@example.com');
    await page.getByLabel('비밀번호').fill('password123');
    await page.getByRole('button', { name: '로그인' }).click();
    await page.getByRole('heading', { name: '승인 대기' }).waitFor();
    await page.getByText('PACA 테스트').waitFor();
    await page.locator('#pendingCount').getByText('2', { exact: true }).waitFor();
    await page.getByRole('button', { name: '승인' }).first().click();
    await page.getByText('가입 신청을 승인했습니다.').waitFor();
    await assertNoRawErrorWords(page);
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await browser.close();
  }
}

async function runLoginErrorFlow() {
  const { browser, page, errors } = await createPage(401);
  try {
    await page.goto(PAGE_URL);
    await page.getByLabel('관리자 이메일').fill('bad@example.com');
    await page.getByLabel('비밀번호').fill('wrong-password');
    await page.getByRole('button', { name: '로그인' }).click();
    await page.getByText('이메일 또는 비밀번호를 확인해주세요.').waitFor();
    await assertNoRawErrorWords(page);
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await browser.close();
  }
}

await runSuccessFlow();
await runLoginErrorFlow();
console.log('mobile approval page smoke passed');
