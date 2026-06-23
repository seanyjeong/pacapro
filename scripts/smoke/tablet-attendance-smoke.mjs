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
const ATTENDANCE_TEST_HREF = '/settings/notifications?service=solapi&template=attendance';

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeSlotResponse(timeSlot = 'evening') {
  const today = toLocalDateStr(new Date());
  return {
    schedule: {
      id: 901,
      class_date: today,
      time_slot: timeSlot,
      students: [
        { student_id: 101, student_name: '김민서', grade: '고3', attendance_status: null, notes: null, season_type: 'regular', is_trial: false, trial_remaining: null, is_makeup: false },
        { student_id: 102, student_name: '박서윤', grade: '고2', attendance_status: 'late', notes: null, season_type: null, is_trial: true, trial_remaining: 1, is_makeup: false },
        { student_id: 103, student_name: '이도현', grade: 'N수', attendance_status: 'excused', notes: '질병', season_type: null, is_trial: false, trial_remaining: null, is_makeup: true },
        { student_id: 104, student_name: '최지훈', grade: '고1', attendance_status: 'present', notes: null, season_type: null, is_trial: false, trial_remaining: null, is_makeup: false },
      ],
    },
    available_students: [],
  };
}

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], submissions: [], ...overrides };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocal = url.origin === BASE_URL;
    const isApi = url.hostname === 'chejump.com' || url.hostname === 'supermax.kr';

    if (!isApi) {
      if (!isLocal) state.externalContinues.push(request.url());
      return route.continue();
    }

    const method = request.method();
    const path = normalizePacaApiPath(url);
    const pathWithSearch = `${path}${url.search}`;
    state.hits.push(`${method} ${pathWithSearch}`);

    if (state.failLoad && method === 'GET' && path === '/schedules/slot') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'GET' && path === '/schedules/slot') {
      return jsonRoute(route, makeSlotResponse(url.searchParams.get('time_slot') || 'evening'));
    }
    if (state.failSave && method === 'POST' && path === '/schedules/901/attendance') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'POST' && path === '/schedules/901/attendance') {
      state.submissions.push(request.postDataJSON());
      return jsonRoute(route, { message: 'saved' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createTabletPage(browser, state) {
  const context = await createAuthedContext(browser, { width: 1180, height: 820 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  return { context, page, diagnostics };
}

async function gotoWorkspace(page) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto('/tablet/attendance', { waitUntil: 'domcontentloaded' });
    try {
      await page.getByTestId('tablet-attendance-workspace').waitFor({ timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return;
    } catch (error) {
      if (attempt === 2) {
        const body = await page.locator('body').innerText().catch(() => '');
        throw new Error(`tablet attendance workspace did not render at ${page.url()}: ${body.slice(0, 500)}\n${error.message}`);
      }
      await page.waitForTimeout(500);
    }
  }
}

async function runNormal(browser) {
  const state = makeState();
  const { context, page, diagnostics } = await createTabletPage(browser, state);

  await gotoWorkspace(page);
  const workspace = page.getByTestId('tablet-attendance-workspace');
  await workspace.getByRole('heading', { name: '출석체크' }).waitFor();
  const testSendLink = workspace.getByRole('link', { name: '출결 테스트발송' });
  await testSendLink.waitFor();
  const testSendHref = await testSendLink.getAttribute('href');
  if (testSendHref !== ATTENDANCE_TEST_HREF) {
    throw new Error(`attendance test send href mismatch: ${testSendHref}`);
  }
  await workspace.getByLabel('학생 이름 검색').fill('박서윤');
  await workspace.getByTestId('tablet-attendance-card').filter({ hasText: '박서윤' }).waitFor();
  await workspace.getByTestId('tablet-attendance-card').filter({ hasText: '김민서' }).waitFor({ state: 'detached' });
  await workspace.getByLabel('학생 이름 검색').fill('');
  await workspace.getByTestId('tablet-attendance-card').filter({ hasText: '김민서' }).getByRole('button', { name: '출석' }).click();
  await workspace.getByTestId('tablet-attendance-card').filter({ hasText: '박서윤' }).getByRole('button', { name: '결석' }).click();
  await page.getByTestId('tablet-attendance-reason-dialog').waitFor();
  await page.getByRole('button', { name: '개인 사정' }).click();
  await page.getByRole('button', { name: '확인' }).click();
  await workspace.getByRole('button', { name: '전체 출석' }).click();
  await workspace.getByRole('tab', { name: '오후' }).click();
  await workspace.getByTestId('tablet-attendance-card').filter({ hasText: '김민서' }).waitFor();

  const first = state.submissions[0]?.attendance_records?.[0];
  const second = state.submissions[1]?.attendance_records?.[0];
  const third = state.submissions[2]?.attendance_records || [];
  if (first?.student_id !== 101 || first?.attendance_status !== 'present') {
    throw new Error(`present payload mismatch: ${JSON.stringify(state.submissions)}`);
  }
  if (second?.student_id !== 102 || second?.attendance_status !== 'absent' || second?.notes !== '개인사정') {
    throw new Error(`absent payload mismatch: ${JSON.stringify(state.submissions)}`);
  }
  if (third.length !== 4 || third.some((record) => record.attendance_status !== 'present')) {
    throw new Error(`all present payload mismatch: ${JSON.stringify(state.submissions)}`);
  }
  if (!state.hits.some((hit) => hit.includes('/schedules/slot') && hit.includes('time_slot=afternoon'))) {
    throw new Error(`missing afternoon slot request: ${state.hits.join(' | ')}`);
  }

  await assertNoRawVisibleText(page, 'tablet attendance normal');
  await assertNoHorizontalOverflow(page, 'tablet attendance normal');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-attendance.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const { context, page, diagnostics } = await createTabletPage(browser, state);

  await gotoWorkspace(page);
  await page.getByText('출석 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'tablet attendance load error');
  await assertNoHorizontalOverflow(page, 'tablet attendance load error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-attendance-load-error.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runSaveError(browser) {
  const state = makeState({ failSave: true });
  const { context, page, diagnostics } = await createTabletPage(browser, state);

  await gotoWorkspace(page);
  const workspace = page.getByTestId('tablet-attendance-workspace');
  await workspace.getByTestId('tablet-attendance-card').filter({ hasText: '김민서' }).getByRole('button', { name: '출석' }).click();
  await page.getByText('출석 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'tablet attendance save error');
  await assertNoHorizontalOverflow(page, 'tablet attendance save error');
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
    const normal = await runNormal(browser);
    const loadError = await runLoadError(browser);
    const saveError = await runSaveError(browser);
    [normal, loadError, saveError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      submissions: normal.state.submissions,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
      saveErrorConsoleErrors: saveError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
