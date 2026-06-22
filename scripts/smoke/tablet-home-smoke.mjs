import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createAuthedContext,
  createDiagnostics,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
} from './paca-smoke-utils.mjs';

async function createTabletHomePage(browser, viewport, userOverride = null) {
  const context = await createAuthedContext(browser, viewport);
  if (userOverride) {
    await context.addInitScript((user) => {
      window.localStorage.setItem('user', JSON.stringify(user));
    }, userOverride);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page };
}

async function runOwnerHome(browser, viewport, label) {
  const result = await createTabletHomePage(browser, viewport);
  const { context, page } = result;

  await page.goto('/tablet', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '태블릿 운영 홈' }).waitFor();
  await page.getByText('PACA 일산', { exact: true }).waitFor();

  const expectedLinks = [
    ['오늘 출석 운영', '/tablet/attendance'],
    ['학생 통합 관리', '/tablet/students'],
    ['결제 확인', '/tablet/payments'],
    ['스케줄 관리', '/tablet/schedule'],
    ['상담예약 운영', '/tablet/consultations'],
    ['문자 발송', '/tablet/sms'],
    ['운영 설정', '/tablet/settings'],
  ];

  for (const [name, href] of expectedLinks) {
    const link = page.getByRole('link', { name });
    await link.waitFor();
    const actualHref = await link.getAttribute('href');
    if (actualHref !== href) throw new Error(`tablet home href mismatch ${name}: ${actualHref}`);
  }

  await assertNoRawVisibleText(page, `tablet home ${label}`);
  await assertNoHorizontalOverflow(page, `tablet home ${label}`);
  await page.screenshot({ path: `/Users/etlab/paca-tablet-home-${label}.png`, fullPage: true });

  await context.close();
  return result;
}

async function runPermissionFilter(browser) {
  const user = {
    id: 2,
    email: 'staff@example.com',
    name: '데스크',
    role: 'staff',
    academy_id: 1,
    academy: { id: 1, name: 'PACA 일산' },
    permissions: {
      schedules: { view: true, edit: true },
      students: { view: true, edit: false },
      payments: { view: false, edit: false },
      consultations: { view: false, edit: false },
      sms: { view: false, edit: false },
    },
  };
  const result = await createTabletHomePage(browser, { width: 820, height: 1180 }, user);
  const { context, page } = result;

  await page.goto('/tablet', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '태블릿 운영 홈' }).waitFor();
  await page.getByRole('link', { name: '오늘 출석 운영' }).waitFor();
  await page.getByRole('link', { name: '학생 통합 관리' }).waitFor();

  for (const hiddenName of ['결제 확인', '상담예약 운영', '문자 발송']) {
    if (await page.getByRole('link', { name: hiddenName }).count()) {
      throw new Error(`${hiddenName} should be hidden for staff without permission`);
    }
  }

  await assertNoRawVisibleText(page, 'tablet home permission filter');
  await assertNoHorizontalOverflow(page, 'tablet home permission filter');

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
    const landscape = await runOwnerHome(browser, { width: 1180, height: 820 }, 'landscape');
    const portrait = await runOwnerHome(browser, { width: 820, height: 1180 }, 'portrait');
    const filtered = await runPermissionFilter(browser);
    [landscape, portrait, filtered].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      landscapeConsoleErrors: landscape.diagnostics.consoleErrors,
      portraitConsoleErrors: portrait.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
