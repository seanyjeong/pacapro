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
const exams = ['3월', '6월', '9월', '수능'];

const healthyStatus = {
  success: true,
  academyId: 1,
  branchName: '일산',
  isConfigured: true,
  jungsiApi: { url: 'https://jungsi.example.test', healthy: true },
  examTypes: exams,
  defaultExam: '수능',
};

const students = [
  { id: 10, name: '김민서', school: '일산고', grade: '고3', status: 'active' },
  { id: 11, name: '한서준', school: '백석고', grade: 'N수', status: 'paused' },
];

const score = {
  year: '2026',
  exam: '3월',
  국어: { 선택과목: '언어와매체', 원점수: 89, 표준점수: 132, 백분위: 96, 등급: '1' },
  수학: { 선택과목: '미적분', 원점수: 82, 표준점수: 128, 백분위: 92, 등급: '2' },
  영어: { 원점수: 91, 등급: '1' },
  한국사: { 원점수: 42, 등급: '2' },
  탐구1: { 선택과목: '생활과윤리', 원점수: 45, 표준점수: 67, 백분위: 94, 등급: '2' },
  탐구2: { 선택과목: '사회문화', 원점수: 47, 표준점수: 69, 백분위: 97, 등급: '1' },
};

function makeState(overrides = {}) {
  return { externalContinues: [], hits: [], ...overrides };
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

    if (state.failStatus && method === 'GET' && path === '/jungsi/status') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/jungsi/status') {
      return jsonRoute(route, healthyStatus);
    }
    if (state.failStudents && method === 'GET' && path === '/students') {
      return jsonRoute(route, { message: 'HTTP 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/students' && url.searchParams.get('status') === 'active,paused') {
      return jsonRoute(route, { students });
    }
    if (method === 'GET' && path.startsWith('/jungsi/scores/10')) {
      if (state.failScores) return jsonRoute(route, { message: 'HTTP 500 stack trace' }, 500);
      const exam = url.searchParams.get('exam');
      if (exam === '3월' || exam === '9월') {
        return jsonRoute(route, { success: true, matched: true, scores: { ...score, exam } });
      }
      return jsonRoute(route, { success: true, matched: false, scores: null });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function waitForConnectedStatus(page) {
  try {
    await page.getByText('정시엔진 연결됨').first().waitFor({ timeout: 10000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('performance-workspace').waitFor();
    await page.getByText('정시엔진 연결됨').first().waitFor();
  }
}

async function openMockExamTab(page) {
  const trigger = page.getByRole('button', { name: '모의고사·수능' });
  await trigger.waitFor({ state: 'visible' });
  await trigger.click();
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/performance', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('performance-workspace').waitFor();
  await page.getByRole('heading', { name: '성적관리' }).waitFor();
  await waitForConnectedStatus(page);
  await openMockExamTab(page);
  await page.getByText('김민서').waitFor();
  await assertNoRawVisibleText(page, 'performance desktop');
  await assertNoHorizontalOverflow(page, 'performance desktop');

  await page.getByPlaceholder('학생 이름, 학교, 학년').fill('김민서');
  await page.getByText('한서준').waitFor({ state: 'hidden' });
  await page.locator('[data-testid="performance-student-row"]:has-text("김민서")').click();
  await page.getByText('3월 모평').waitFor();
  await page.getByText('언어와매체').first().waitFor();
  for (const exam of exams) {
    if (!state.hits.some((hit) => hit.includes(`/jungsi/scores/10?exam=${encodeURIComponent(exam)}`))) {
      throw new Error(`missing score request for ${exam}: ${state.hits.join(' | ')}`);
    }
  }
  await page.screenshot({ path: '/Users/etlab/paca-performance-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('performance-workspace').waitFor();
  await waitForConnectedStatus(page);
  await openMockExamTab(page);
  await assertNoRawVisibleText(page, 'performance mobile');
  await assertNoHorizontalOverflow(page, 'performance mobile');
  await page.screenshot({ path: '/Users/etlab/paca-performance-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runStatusError(browser) {
  const state = makeState({ failStatus: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/performance', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('performance-workspace').waitFor();
  await page.getByRole('heading', { name: '성적관리' }).waitFor();
  await page.getByText('연결 확인 필요').waitFor();
  await openMockExamTab(page);
  await page.getByText('정시엔진 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'performance status error');
  await assertNoHorizontalOverflow(page, 'performance status error');
  await page.screenshot({ path: '/Users/etlab/paca-performance-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runStudentsError(browser) {
  const state = makeState({ failStudents: true });
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/performance', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('performance-workspace').waitFor();
  await page.getByRole('heading', { name: '성적관리' }).waitFor();
  await waitForConnectedStatus(page);
  await openMockExamTab(page);
  await page.getByText('학생 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'performance students error');

  await context.close();
  return { state, diagnostics };
}

async function runScoresError(browser) {
  const state = makeState({ failScores: true });
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/performance', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('performance-workspace').waitFor();
  await page.getByRole('heading', { name: '성적관리' }).waitFor();
  await waitForConnectedStatus(page);
  await openMockExamTab(page);
  await page.getByText('김민서').waitFor();
  await page.locator('[data-testid="performance-student-row"]:has-text("김민서")').click();
  await page.getByText('성적 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'performance scores error');

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
    const statusError = await runStatusError(browser);
    const studentsError = await runStudentsError(browser);
    const scoresError = await runScoresError(browser);
    [normal, statusError, studentsError, scoresError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      statusErrorConsoleErrors: statusError.diagnostics.consoleErrors,
      studentsErrorConsoleErrors: studentsError.diagnostics.consoleErrors,
      scoresErrorConsoleErrors: scoresError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
