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

function makePermissions() {
  return {
    students: { view: true, edit: true },
    payments: { view: true, edit: false },
    staff: { view: true, edit: false },
  };
}

function makeState(mode) {
  return { deletedStaffId: null, hits: [], mode, permissionPayload: null, permissions: makePermissions() };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'supermax.kr';

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

    if (method === 'GET' && path === '/staff') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        staff: state.deletedStaffId ? [] : [
          {
            id: 11,
            email: 'manager@example.com',
            name: '김관리',
            position: '실장',
            permissions: state.permissions,
            instructor_id: 4,
            is_active: true,
            created_at: '2026-06-01T09:00:00.000Z',
          },
        ],
      });
    }

    if (method === 'GET' && path === '/staff/available-instructors') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        instructors: [
          { id: 7, name: '박강사', phone: '010-1111-2222', status: 'active', instructor_type: 'part_time' },
        ],
      });
    }

    if (method === 'PUT' && path === '/staff/11/permissions') {
      state.permissionPayload = JSON.parse(request.postData() || '{}');
      state.permissions = state.permissionPayload.permissions;
      return jsonRoute(route, { message: 'updated' });
    }

    if (method === 'DELETE' && path === '/staff/11') {
      state.deletedStaffId = 11;
      return jsonRoute(route, { message: 'deleted' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createStaffPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function gotoStaff(page) {
  const staffResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET' && normalizePacaApiPath(url) === '/staff';
  });
  const instructorsResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET' && normalizePacaApiPath(url) === '/staff/available-instructors';
  });
  await page.goto('/staff', { waitUntil: 'domcontentloaded' });
  await Promise.all([staffResponse, instructorsResponse]);
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

async function runDesktop(browser) {
  const result = await createStaffPage(browser, 'success');
  const { context, page, state } = result;

  await gotoStaff(page);
  await page.getByRole('heading', { name: '직원 관리' }).waitFor();
  await page.getByTestId('staff-operations-workspace').waitFor();
  await page.getByTestId('staff-summary-strip').waitFor();
  await page.getByTestId('staff-work-queue').waitFor();
  await page.getByText('관리 계정 운영 보드').waitFor();
  await page.getByText('박강사').waitFor();
  const desktopList = page.getByTestId('staff-desktop-list');
  await desktopList.getByText('김관리').waitFor();
  await desktopList.getByText('manager@example.com').waitFor();
  await page.getByRole('button', { name: '김관리 권한 설정' }).click();
  await page.getByText('김관리 권한 설정').waitFor();
  await page.getByText('저장된 권한과 동일합니다.').waitFor();
  await page.getByRole('button', { name: '전체 보기' }).click();
  await page.getByText('저장하지 않은 변경사항이 있습니다.').waitFor();
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'PUT' && normalizePacaApiPath(url) === '/staff/11/permissions';
    }),
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET' && normalizePacaApiPath(url) === '/staff';
    }),
    page.getByRole('button', { name: '권한 저장' }).click(),
  ]);

  if (!state.permissionPayload?.permissions?.students?.view) {
    throw new Error(`permission payload mismatch: ${JSON.stringify(state.permissionPayload)}`);
  }
  await desktopList.getByText('보기: 19개, 수정: 1개').waitFor();

  await clickWithoutNativeDialog(page, desktopList.getByRole('button', { name: '김관리 삭제' }), 'staff delete');
  const deleteDialog = page.getByRole('alertdialog');
  await deleteDialog.getByRole('heading', { name: '직원 계정 삭제' }).waitFor();
  await deleteDialog.getByText('김관리').waitFor();
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'DELETE' && normalizePacaApiPath(url) === '/staff/11';
    }),
    deleteDialog.getByRole('button', { name: '삭제' }).click(),
  ]);
  await page.getByText('직원 계정이 삭제되었습니다.').waitFor();
  await deleteDialog.waitFor({ state: 'hidden' });
  await page.getByText('등록된 직원이 없습니다').waitFor();
  if (state.deletedStaffId !== 11) throw new Error('staff delete endpoint was not called');

  await assertNoRawVisibleText(page, 'staff desktop');
  await assertNoHorizontalOverflow(page, 'staff desktop');
  await page.screenshot({ path: '/Users/etlab/paca-staff-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobile(browser) {
  const result = await createStaffPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await gotoStaff(page);
  await page.getByRole('heading', { name: '직원 관리' }).waitFor();
  await page.getByTestId('staff-operations-workspace').waitFor();
  await page.getByTestId('staff-summary-strip').waitFor();
  await page.getByTestId('staff-work-queue').waitFor();
  const mobileList = page.getByTestId('staff-mobile-list');
  await mobileList.getByText('김관리').waitFor();
  await mobileList.getByRole('button', { name: '김관리 권한 설정' }).waitFor();
  await assertNoRawVisibleText(page, 'staff mobile');
  await assertNoHorizontalOverflow(page, 'staff mobile');
  await page.screenshot({ path: '/Users/etlab/paca-staff-mobile.png', fullPage: true });
  await mobileList.getByRole('button', { name: '김관리 권한 설정' }).click();
  await page.getByText('김관리 권한 설정').waitFor();
  await page.getByText('저장된 권한과 동일합니다.').waitFor();
  await page.getByRole('button', { name: '권한 저장' }).waitFor();
  await assertNoRawVisibleText(page, 'staff mobile permission modal');
  await assertNoHorizontalOverflow(page, 'staff mobile permission modal');
  await page.screenshot({ path: '/Users/etlab/paca-staff-modal-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createStaffPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await gotoStaff(page);
  await page.getByRole('heading', { name: '직원 관리' }).waitFor();
  await page.getByRole('heading', { name: '직원 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
  await assertNoRawVisibleText(page, 'staff load error');
  await assertNoHorizontalOverflow(page, 'staff load error');
  await page.screenshot({ path: '/Users/etlab/paca-staff-error-mobile.png', fullPage: true });

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
    const desktop = await runDesktop(browser);
    const mobile = await runMobile(browser);
    const loadError = await runLoadError(browser);
    [desktop, mobile, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      deletedStaffId: desktop.state.deletedStaffId,
      errorConsoleErrors: loadError.diagnostics.consoleErrors,
      errorHits: loadError.state.hits,
      mobileHits: mobile.state.hits,
      permissionPayload: desktop.state.permissionPayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
