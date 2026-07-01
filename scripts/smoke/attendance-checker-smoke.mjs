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

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeSchedule() {
  return {
    id: 901,
    class_date: formatDate(new Date()),
    time_slot: 'evening',
    instructor_id: 77,
    instructor_name: '박코치',
    title: '저녁 실기 집중반',
    content: '',
    attendance_taken: false,
    notes: '',
    student_count: 2,
    trial_count: 0,
    created_at: '2026-06-23T09:00:00.000Z',
    updated_at: '2026-06-23T09:00:00.000Z',
  };
}

function makeAttendances() {
  return [
    {
      student_id: 101,
      student_name: '김민서',
      student_number: 'S-101',
      attendance_status: null,
      notes: null,
      is_makeup: false,
    },
    {
      student_id: 102,
      student_name: '박서윤',
      student_number: 'S-102',
      attendance_status: 'late',
      notes: null,
      is_makeup: false,
    },
  ];
}

function makeState() {
  return { hits: [] };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocal = url.origin === BASE_URL;
    const isApi = url.hostname === 'supermax.kr';

    if (!isApi) {
      if (!isLocal) state.hits.push(`EXTERNAL ${request.url()}`);
      return route.continue();
    }

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/schedules/901') {
      return jsonRoute(route, { schedule: makeSchedule() });
    }

    if (method === 'GET' && path === '/schedules/901/attendance') {
      return jsonRoute(route, { schedule: makeSchedule(), students: makeAttendances() });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1280, height: 860 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/schedules/901/attendance', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '출석 체크' }).waitFor();
  await page.getByText('저녁 실기 집중반').waitFor();
  await page.getByText('출석 통계').waitFor();

  const testSendLink = page.getByRole('link', { name: '출결 테스트발송' });
  await testSendLink.waitFor();
  const testSendHref = await testSendLink.getAttribute('href');
  if (testSendHref !== ATTENDANCE_TEST_HREF) {
    throw new Error(`attendance test send href mismatch: ${testSendHref}`);
  }

  await assertNoRawVisibleText(page, 'attendance checker normal');
  await assertNoHorizontalOverflow(page, 'attendance checker normal');
  await page.screenshot({ path: '/Users/etlab/paca-attendance-checker.png', fullPage: true });
  await context.close();
  return { diagnostics, state };
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const normal = await runNormal(browser);
    assertDiagnostics(normal);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
