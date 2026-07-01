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

function makePausedStudent() {
  return {
    id: 42,
    academy_id: 1,
    student_number: 'S-2026-042',
    name: '이복귀',
    gender: 'female',
    student_type: 'exam',
    phone: '010-2222-3333',
    parent_phone: '010-4444-5555',
    school: '일산여고',
    grade: '고2',
    admission_type: 'regular',
    class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
    weekly_count: 2,
    monthly_tuition: '520000',
    discount_rate: '10',
    payment_due_day: 5,
    final_monthly_tuition: '468000',
    is_season_registered: false,
    current_season_id: null,
    status: 'paused',
    rest_start_date: '2026-06-01',
    rest_end_date: null,
    rest_reason: '부상 회복',
    enrollment_date: '2026-03-04',
    academy_name: 'PACA 일산',
    created_at: '2026-02-20T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
  };
}

function makeState(overrides = {}) {
  return { hits: [], resumePayloads: [], ...overrides };
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

    if (method === 'GET' && path === '/students/42') {
      return jsonRoute(route, {
        message: 'ok',
        payments: [],
        performances: [],
        student: makePausedStudent(),
      });
    }

    if (method === 'GET' && path === '/students/42/rest-credits') {
      return jsonRoute(route, { credits: [], message: 'ok', pendingTotal: 0 });
    }

    if (method === 'POST' && path === '/students/42/resume') {
      state.resumePayloads.push(request.postDataJSON());
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, { settings: { academy_name: 'PACA 일산' } });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function runResumeError(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);

  await page.goto('/students/42', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByRole('button', { name: '복귀 처리' }).click();
  await page.getByRole('heading', { name: '휴원 복귀 처리' }).waitFor();
  const resumeResponse = page.waitForResponse((response) => response.url().includes('/students/42/resume'));
  await page.getByRole('button', { name: '복귀 처리' }).last().click();
  await resumeResponse;
  await page.waitForTimeout(100);
  await assertNoRawVisibleText(page, 'student resume error');
  await page.getByRole('alert').getByText('복귀 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoHorizontalOverflow(page, 'student resume error');
  await page.screenshot({ path: '/Users/etlab/paca-student-resume-error-mobile.png', fullPage: true });

  if (!state.resumePayloads.at(-1)?.resume_date) {
    throw new Error(`resume payload missing date: ${JSON.stringify(state.resumePayloads)}`);
  }

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
    const resumeError = await runResumeError(browser);
    assertDiagnostics(resumeError);
    console.log(JSON.stringify({
      hits: resumeError.state.hits,
      resumePayload: resumeError.state.resumePayloads.at(-1),
      consoleErrors: resumeError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
