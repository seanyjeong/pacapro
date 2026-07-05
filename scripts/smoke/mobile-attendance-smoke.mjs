import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createAuthedContext,
  createDiagnostics,
  installFakeAttendanceSocket,
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

function makeStudent(index, overrides = {}) {
  return {
    student_id: 100 + index,
    student_name: `테스트학생${String(index).padStart(2, '0')}`,
    grade: index % 3 === 0 ? '고3' : index % 3 === 1 ? '고2' : '고1',
    attendance_status: null,
    notes: null,
    season_type: null,
    phone: '010-1111-2222',
    parent_phone: '010-3333-4444',
    is_trial: false,
    trial_remaining: null,
    is_makeup: false,
    ...overrides,
  };
}

const SLOT_STUDENTS = [
  makeStudent(1, { student_id: 101, student_name: '김민서', grade: '고3', season_type: 'regular' }),
  makeStudent(2, { student_id: 102, student_name: '박서윤', grade: '고2', attendance_status: 'late', phone: null, is_trial: true, trial_remaining: 1 }),
  makeStudent(3, { student_id: 103, student_name: '이도현', grade: 'N수', attendance_status: 'excused', notes: '질병', parent_phone: null, is_makeup: true }),
  ...Array.from({ length: 21 }, (_, index) => makeStudent(index + 4)),
];

function makeSlotResponse(timeSlot = 'evening') {
  const today = toLocalDateStr(new Date());
  return {
    schedule: {
      id: 901,
      class_date: today,
      time_slot: timeSlot,
      students: SLOT_STUDENTS,
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
    const isApi = url.hostname === 'supermax.kr';

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

async function createMobilePage(browser, state) {
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installFakeAttendanceSocket(context);
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  return { context, page, diagnostics };
}

async function gotoWorkspace(page) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto('/m/attendance', { waitUntil: 'domcontentloaded' });
    try {
      await page.getByTestId('mobile-attendance-workspace').waitFor({ timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return;
    } catch (error) {
      if (attempt === 2) {
        const body = await page.locator('body').innerText().catch(() => '');
        throw new Error(`mobile attendance workspace did not render at ${page.url()}: ${body.slice(0, 500)}\n${error.message}`);
      }
      await page.waitForTimeout(500);
    }
  }
}

async function runNormal(browser) {
  const state = makeState();
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await page.getByRole('heading', { name: '학생 출석체크' }).waitFor();
  const testSendLink = page.getByRole('link', { name: '출결 테스트발송' });
  await testSendLink.waitFor();
  const testSendHref = await testSendLink.getAttribute('href');
  if (testSendHref !== ATTENDANCE_TEST_HREF) {
    throw new Error(`attendance test send href mismatch: ${testSendHref}`);
  }
  await page.screenshot({ path: '/Users/etlab/paca-mobile-attendance-list.png', fullPage: true });
  await page.locator('[data-testid="mobile-attendance-row"]:has-text("김민서")').getByRole('button', { name: '출석' }).click();
  await page.locator('[data-testid="mobile-attendance-row"]:has-text("박서윤")').getByRole('button', { name: '결석' }).click();
  await page.getByTestId('mobile-attendance-reason-sheet').waitFor();
  await page.getByRole('button', { name: '개인 사정' }).click();
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('button', { name: '전체 출석' }).click();
  await page.getByRole('tab', { name: '오후' }).click();
  await page.locator('[data-testid="mobile-attendance-row"]:has-text("김민서")').waitFor();

  const first = state.submissions[0]?.attendance_records?.[0];
  const second = state.submissions[1]?.attendance_records?.[0];
  const third = state.submissions[2]?.attendance_records || [];
  if (first?.student_id !== 101 || first?.attendance_status !== 'present') {
    throw new Error(`present payload mismatch: ${JSON.stringify(state.submissions)}`);
  }
  if (second?.student_id !== 102 || second?.attendance_status !== 'absent' || second?.notes !== '개인사정') {
    throw new Error(`absent payload mismatch: ${JSON.stringify(state.submissions)}`);
  }
  if (third.length !== SLOT_STUDENTS.length || third.some((record) => record.attendance_status !== 'present')) {
    throw new Error(`all present payload mismatch: ${JSON.stringify(state.submissions)}`);
  }
  if (!state.hits.some((hit) => hit.includes('/schedules/slot') && hit.includes('time_slot=afternoon'))) {
    throw new Error(`missing afternoon slot request: ${state.hits.join(' | ')}`);
  }

  await assertNoRawVisibleText(page, 'mobile attendance normal');
  await assertNoHorizontalOverflow(page, 'mobile attendance normal');
  await page.screenshot({ path: '/Users/etlab/paca-mobile-attendance.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runRealtimeScroll(browser) {
  const state = makeState();
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  const lastRow = page.getByTestId('mobile-attendance-row').last();
  await lastRow.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  if (before < 300) throw new Error(`mobile attendance test did not scroll enough: ${before}`);

  await lastRow.getByRole('button', { name: '출석' }).click();
  await page.waitForTimeout(30);
  await page.evaluate(() => window.__emitPacaAttendanceUpdate?.(901));
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => window.scrollY);
  if (after < before - 40) {
    throw new Error(`mobile attendance realtime refresh moved scroll from ${before} to ${after}`);
  }

  const lastRowVisible = await lastRow.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  if (!lastRowVisible) throw new Error('mobile attendance bottom row disappeared after realtime refresh');

  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await page.getByText('출석 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile attendance load error');
  await assertNoHorizontalOverflow(page, 'mobile attendance load error');
  await page.screenshot({ path: '/Users/etlab/paca-mobile-attendance-load-error.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runSaveError(browser) {
  const state = makeState({ failSave: true });
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await page.locator('[data-testid="mobile-attendance-row"]:has-text("김민서")').getByRole('button', { name: '출석' }).click();
  await page.getByText('출석 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile attendance save error');
  await assertNoHorizontalOverflow(page, 'mobile attendance save error');
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
    const realtimeScroll = await runRealtimeScroll(browser);
    const loadError = await runLoadError(browser);
    const saveError = await runSaveError(browser);
    [normal, realtimeScroll, loadError, saveError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      submissions: normal.state.submissions,
      realtimeScrollHits: realtimeScroll.state.hits,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      realtimeScrollConsoleErrors: realtimeScroll.diagnostics.consoleErrors,
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
