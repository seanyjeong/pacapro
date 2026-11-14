import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createAuthedContext,
  createDiagnostics,
  jsonRoute,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
  statTile,
} from './paca-smoke-utils.mjs';

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthRange(date = new Date()) {
  return {
    end: formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    month: date.getMonth(),
    start: formatDate(new Date(date.getFullYear(), date.getMonth(), 1)),
    today: formatDate(date),
    year: date.getFullYear(),
  };
}

const range = monthRange();
const schedule = {
  id: 101,
  class_date: range.today,
  time_slot: 'afternoon',
  instructor_id: 3,
  instructor_name: '박코치',
  title: '오후 실기 집중반',
  content: '기초 체력 및 기록 점검',
  attendance_taken: false,
  notes: '실내',
  student_count: 8,
  trial_count: 1,
  created_at: '2026-06-01T09:00:00Z',
  updated_at: '2026-06-01T09:00:00Z',
};

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'supermax.kr';
    if (!isApi) return route.continue();

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/schedules') {
      return jsonRoute(route, { schedules: [schedule] });
    }
    if (method === 'GET' && path === '/schedules/instructor-schedules/month') {
      return jsonRoute(route, {
        schedules: {
          [range.today]: {
            morning: { scheduled: 1, attended: 1 },
            afternoon: { scheduled: 2, attended: 1 },
            evening: { scheduled: 1, attended: 0 },
          },
        },
      });
    }
    if (method === 'GET' && path === '/consultations/calendar/events') {
      return jsonRoute(route, { events: { [range.today]: [{ id: 1, student_name: '상담학생' }] } });
    }
    if (method === 'GET' && path === '/instructors/overtime/pending') {
      return jsonRoute(route, { requests: [{ id: 7 }] });
    }
    if (method === 'GET' && path === `/schedules/date/${range.today}/instructor-attendance`) {
      const instructor = { id: 3, name: '박코치', salary_type: 'hourly' };
      return jsonRoute(route, { attendances: [], instructors: [instructor], instructors_by_slot: { afternoon: [instructor] } });
    }
    if (method === 'GET' && path === '/instructors') {
      return jsonRoute(route, { instructors: [{ id: 3, name: '박코치', salary_type: 'hourly', status: 'active' }] });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createPage(browser, viewport) {
  const state = { hits: [] };
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

// 새 디자인: '수업 운영 보드'를 '수업 숫자 요약' 줄(같은 test id)로 합쳤다. 상담 일정 수는 '선택일 상담' 칸(누르면 상담 달력),
// 승인 대기 수는 머리의 '승인 대기' 버튼 배지, 수업 등록·출결 테스트발송은 머리 버튼, 강사 출근·미배정 출근·출석 체크는
// 선택일 카드로 옮겨졌다.
async function assertScheduleBoard(page, label) {
  const board = page.getByTestId('schedules-operations-board');
  await board.waitFor();
  if ((await board.getAttribute('aria-label')) !== '수업 숫자 요약') throw new Error('schedule summary label mismatch');
  await statTile(board, '이번 달 수업').getByText('1건', { exact: true }).waitFor();
  await statTile(board, '선택일 수업').getByText('1건', { exact: true }).waitFor();
  await statTile(board, '선택일 학생').getByText('8명', { exact: true }).waitFor();
  await statTile(board, '선택일 상담').getByText('1건', { exact: true }).waitFor();
  await page.locator('header').getByRole('button', { name: /^승인 대기\s*1$/ }).waitFor();
  await page.getByRole('button', { name: '강사 출근' }).waitFor();
  await page.getByRole('button', { name: '미배정 출근' }).waitFor();
  await page.locator('header').getByRole('button', { name: '개별수업등록' }).waitFor();
  const attendanceHref = await page.getByTestId('selected-date-operations').getByRole('link', { name: /출석 체크$/ }).getAttribute('href');
  if (attendanceHref !== '/schedules/101/attendance') throw new Error(`schedule attendance href mismatch: ${attendanceHref}`);
  const attendanceTestHref = await page.locator('header').getByRole('link', { name: '출결 테스트발송' }).getAttribute('href');
  if (attendanceTestHref !== '/settings/notifications?service=solapi&template=attendance') {
    throw new Error(`attendance test send href mismatch: ${attendanceTestHref}`);
  }
  await assertNoRawVisibleText(page, label);
  await assertNoHorizontalOverflow(page, label);
}

// 옛 보드의 '상담 일정 보기'·'수업 등록' 링크 주소는 이제 버튼을 눌러 이동한 주소로 확인한다.
async function assertScheduleNavigation(page) {
  await statTile(page.getByTestId('schedules-operations-board'), '선택일 상담').click();
  await page.waitForURL(`**/consultations/calendar?from=schedule&date=${range.today}`);
  await page.goBack({ waitUntil: 'networkidle' });
  await page.locator('header').getByRole('button', { name: '개별수업등록' }).click();
  await page.waitForURL(`**/schedules/new?date=${range.today}`);
  await page.goBack({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '수업 관리' }).waitFor();
}

async function runDesktop(browser) {
  const result = await createPage(browser, { width: 1365, height: 900 });
  const { context, page, state } = result;
  await page.goto('/schedules', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '수업 관리' }).waitFor();
  await assertScheduleBoard(page, 'schedule workspace desktop');
  await page.getByRole('button', { name: '강사 출근' }).click();
  await page.getByRole('heading', { name: '강사 출근 체크', exact: true }).waitFor();
  await page.getByRole('button', { name: '닫기' }).click();
  await assertScheduleBoard(page, 'schedule workspace desktop after modal');
  await page.screenshot({ path: '/Users/etlab/paca-schedule-workspace-desktop.png', fullPage: true });
  await assertScheduleNavigation(page);
  await context.close();
  return { diagnostics: result.diagnostics, state };
}

async function runMobile(browser) {
  const result = await createPage(browser, { width: 390, height: 844 });
  const { context, page, state } = result;
  await page.goto('/schedules', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '수업 관리' }).waitFor();
  await assertScheduleBoard(page, 'schedule workspace mobile');
  await page.screenshot({ path: '/Users/etlab/paca-schedule-workspace-mobile.png', fullPage: true });
  await context.close();
  return { diagnostics: result.diagnostics, state };
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
    [desktop, mobile].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      mobileHits: mobile.state.hits,
      normalConsoleErrors: desktop.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
