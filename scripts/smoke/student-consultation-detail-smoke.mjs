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

function makeStudent() {
  return {
    id: 41,
    academy_id: 1,
    student_number: 'S-2026-041',
    name: '김진우',
    gender: 'male',
    student_type: 'exam',
    phone: '010-1111-2222',
    parent_phone: '010-3333-4444',
    school: '일산고',
    grade: '고2',
    admission_type: 'regular',
    class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
    weekly_count: 2,
    monthly_tuition: '520000',
    discount_rate: '10',
    discount_reason: '형제 할인',
    payment_due_day: 5,
    final_monthly_tuition: '468000',
    is_season_registered: true,
    current_season_id: 7,
    status: 'active',
    enrollment_date: '2026-03-04',
    consultation_date: '2026-02-20',
    academy_name: 'PACA 일산',
    created_at: '2026-02-20T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
  };
}

function makeConsultation() {
  return {
    id: 88,
    student_id: 41,
    consultation_date: '2026-06-20',
    consultation_type: 'regular',
    admission_type: 'regular',
    school_grade_avg: 3.2,
    mock_test_scores: JSON.stringify({
      june: { korean: 2, math: 3, english: 2, exploration1: 4, exploration2: 3 },
    }),
    academic_memo: '수학 보완이 필요합니다.',
    physical_record_type: 'latest',
    physical_records: JSON.stringify({ '100m': { value: '12.4', unit: '초' } }),
    physical_memo: '스타트 집중 관리',
    target_university_1: '한국체대',
    target_university_2: '용인대',
    target_memo: '정시 실기 비중 확인',
    general_memo: '다음 상담 때 실기 기록을 다시 확인합니다.',
    created_at: '2026-06-20T09:00:00.000Z',
  };
}

function makeState() {
  return { failConsultations: false, hits: [] };
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

    if (method === 'GET' && path === '/students/41') {
      return jsonRoute(route, {
        message: 'ok',
        payments: [],
        performances: [],
        student: makeStudent(),
      });
    }

    if (method === 'GET' && path === '/student-consultations/41') {
      if (state.failConsultations) {
        return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, { consultations: [makeConsultation()], initialConsultations: [] });
    }

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, { settings: { academy_name: 'PACA 일산' } });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
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

async function runPdfFailure(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByRole('button', { exact: true, name: '상담 기록' }).click();
  await page.getByTitle('상세보기 / PDF 저장').waitFor();
  await page.getByTitle('상세보기 / PDF 저장').click();
  await page.getByRole('heading', { name: '상담 기록 상세' }).waitFor();

  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toDataURL = () => {
      throw new Error('HTTP 500 DB stack trace');
    };
  });
  await clickWithoutNativeDialog(page, page.getByRole('button', { exact: true, name: 'PDF 저장' }), 'consultation PDF save');
  await page.getByRole('alert').getByText('PDF를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'student consultation PDF error');
  await assertNoHorizontalOverflow(page, 'student consultation PDF error');
  await page.screenshot({ path: '/Users/etlab/paca-student-consultation-pdf-error-mobile.png', fullPage: true });

  await context.close();
  return { diagnostics, state };
}

async function runConsultationLoadError(browser) {
  const state = makeState();
  state.failConsultations = true;
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  const loadResponse = page.waitForResponse((response) => response.url().includes('/student-consultations/41'));
  await page.getByRole('button', { exact: true, name: '상담 기록' }).click();
  await loadResponse;
  await page.waitForTimeout(100);
  await assertNoRawVisibleText(page, 'student consultation load error');
  await page.getByText('상담 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
  await assertNoHorizontalOverflow(page, 'student consultation load error');
  await page.screenshot({ path: '/Users/etlab/paca-student-consultation-load-error-mobile.png', fullPage: true });

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
    const pdfFailure = await runPdfFailure(browser);
    const loadError = await runConsultationLoadError(browser);
    [pdfFailure, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: pdfFailure.state.hits,
      loadErrorHits: loadError.state.hits,
      pdfFailureConsoleErrors: pdfFailure.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
