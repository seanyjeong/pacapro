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

const TEST_DATE = '2026-06-24';

function makeConsultation(overrides = {}) {
  return {
    id: 610,
    academy_id: 1,
    consultation_type: 'new_registration',
    parent_name: '김진우 학부모',
    parent_phone: '010-3333-4444',
    student_name: '김진우',
    student_phone: '010-1111-2222',
    student_grade: '고2',
    student_school: '일산고',
    gender: 'male',
    preferred_date: TEST_DATE,
    preferred_time: '10:30',
    status: 'pending',
    admin_notes: '정시 상담',
    inquiry_content: '운동 기록 상담',
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    ...overrides,
  };
}

function makeState(mode = 'success') {
  return { hits: [], mode };
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
      return jsonRoute(route, { settings: { academy_name: 'PACA 일산' } });
    }

    if (method === 'GET' && path === '/consultations') {
      const isSidebarCount = url.searchParams.get('limit') === '1';
      if (state.mode === 'load-error' && !isSidebarCount) {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        consultations: [
          makeConsultation(),
          makeConsultation({
            id: 611,
            consultation_type: 'learning',
            learning_type: 'regular',
            parent_name: '',
            parent_phone: '',
            student_name: '박서연',
            student_phone: '010-5555-6666',
            student_grade: '고3',
            preferred_time: '11:00',
            status: 'confirmed',
          }),
        ],
        pagination: { total: 2, page: 1, limit: 100, totalPages: 1 },
        stats: { total: 2, pending: 1, confirmed: 1, completed: 0, cancelled: 0, no_show: 0 },
      });
    }

    if (method === 'GET' && path === '/student-consultations/calendar') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        consultations: [
          { id: 91, student_id: 41, student_name: '김진우', consultation_date: TEST_DATE, memo: '정시 운동 기록 점검' },
        ],
      });
    }

    if (method === 'GET' && path === '/students') {
      return jsonRoute(route, {
        students: [
          { id: 41, name: '김진우', grade: '고2' },
          { id: 42, name: '박서연', grade: '고3' },
        ],
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createCalendarPage(browser, viewport = { width: 1365, height: 900 }, mode = 'success') {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function runDesktop(browser) {
  const result = await createCalendarPage(browser);
  const { context, page } = result;

  await page.goto(`/consultations/calendar?date=${TEST_DATE}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 달력' }).waitFor();
  await waitForCalendarShell(page);
  await page.getByTestId('consultation-calendar-month-card').getByText('2026년 6월').waitFor();
  await page.getByText('김진우').first().waitFor();
  await page.getByText('상담 일정').waitFor();
  await assertNoRawVisibleText(page, 'consultation calendar desktop');
  await assertNoHorizontalOverflow(page, 'consultation calendar desktop');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-calendar-desktop.png', fullPage: true });

  await page.locator('.fixed button').filter({ hasText: '김진우' }).first().click();
  await page.getByText('상담 신청 상세').waitFor();
  await page.getByText('운동 기록 상담').waitFor();
  await assertNoRawVisibleText(page, 'consultation calendar detail');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-calendar-detail-desktop.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobile(browser) {
  const result = await createCalendarPage(browser, { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/consultations/calendar', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 달력' }).waitFor();
  await waitForCalendarShell(page);
  await page.getByText('김진우').first().waitFor();
  await assertNoRawVisibleText(page, 'consultation calendar mobile');
  await assertNoHorizontalOverflow(page, 'consultation calendar mobile');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-calendar-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createCalendarPage(browser, { width: 390, height: 844 }, 'load-error');
  const { context, page } = result;

  await page.goto('/consultations/calendar', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('consultation-calendar-operations-workspace').waitFor();
  await page.getByTestId('consultation-calendar-work-queue').waitFor();
  await page.getByRole('heading', { name: '상담 달력 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByText('잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'consultation calendar load error');
  await assertNoHorizontalOverflow(page, 'consultation calendar load error');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-calendar-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function waitForCalendarShell(page) {
  await page.getByTestId('consultation-calendar-operations-workspace').waitFor();
  await page.getByTestId('consultation-calendar-month-card').waitFor();
  const queue = page.getByTestId('consultation-calendar-work-queue');
  await queue.waitFor();
  await queue.getByText('월간 상담 운영 보드').waitFor();
  await queue.getByText('신규 상담', { exact: true }).waitFor();
  await queue.getByText('재원생 상담', { exact: true }).waitFor();
  await queue.getByText('상담 메모', { exact: true }).waitFor();
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
      errorHits: loadError.state.hits,
      mobileHits: mobile.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
