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

function makeState(mode) {
  return {
    directPayload: null,
    hits: [],
    mode,
  };
}

function mockConsultation() {
  return {
    id: 11,
    academy_id: 1,
    consultation_type: 'new_registration',
    parent_name: '김보호자',
    parent_phone: '010-1111-2222',
    student_name: '김진우',
    student_phone: '010-1111-2222',
    student_grade: '고2',
    student_school: '일산고',
    gender: 'male',
    preferred_date: TEST_DATE,
    preferred_time: '09:30',
    status: 'pending',
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
  };
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

    if (method === 'GET' && path === '/consultations/settings/info') {
      return jsonRoute(route, {
        academy: { id: 1, name: state.mode === 'missing-hours' ? 'PACA 강남' : 'PACA 일산' },
        settings: {
          isEnabled: true,
          slotDuration: 30,
          maxReservationsPerSlot: 1,
          advanceDays: 30,
          referralSources: ['지인추천'],
        },
        weeklyHours: state.mode === 'missing-hours'
          ? []
          : [{ dayOfWeek: 3, isAvailable: true, startTime: '09:00', endTime: '11:00' }],
        blockedSlots: [],
      });
    }

    if (method === 'GET' && path === '/consultations/booked-times') {
      return jsonRoute(route, { date: url.searchParams.get('date') || TEST_DATE, bookedTimes: ['10:00'] });
    }

    if (method === 'GET' && path === '/consultations') {
      const isPageList = url.searchParams.get('page') === '1' &&
        url.searchParams.get('consultationType') === 'new_registration' &&
        !url.searchParams.has('status');
      if (state.mode === 'list-error' && isPageList) {
        return jsonRoute(route, { message: 'DB timeout' }, 500);
      }

      return jsonRoute(route, {
        consultations: [mockConsultation()],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
        stats: { pending: 1, confirmed: 0, completed: 0, cancelled: 0, no_show: 0 },
      });
    }

    if (method === 'POST' && path === '/consultations/direct') {
      state.directPayload = JSON.parse(request.postData() || '{}');
      if (state.mode === 'save-error') {
        return jsonRoute(route, { message: 'DB timeout' }, 500);
      }
      return jsonRoute(route, { message: 'created', id: 77 });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createNewInquiryPage(browser, mode, viewport = { width: 1280, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  return { context, page, state, diagnostics };
}

async function openCreateDialog(page) {
  await page.goto('/consultations/new-inquiry', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '신규상담', exact: true }).waitFor({ timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.getByRole('button', { name: '신규상담 등록' }).click();
  await page.getByRole('heading', { name: '신규상담 등록' }).waitFor();
}

async function selectOption(page, label, optionName) {
  await page.getByLabel(label).click();
  await page.getByText(optionName, { exact: true }).last().click();
}

async function runMissingHours(browser) {
  const result = await createNewInquiryPage(browser, 'missing-hours', { width: 390, height: 844 });
  const { context, page } = result;

  await openCreateDialog(page);
  await page.getByLabel('상담 날짜').fill(TEST_DATE);
  await page.getByText('상담 가능 시간이 설정되지 않았습니다').waitFor({ timeout: 10000 });
  await page.getByRole('link', { name: '상담 설정으로 이동' }).waitFor();
  await assertNoRawVisibleText(page, 'new inquiry missing hours');
  await assertNoHorizontalOverflow(page, 'new inquiry missing hours');
  await page.screenshot({ path: '/Users/etlab/paca-new-inquiry-missing-hours.png', fullPage: true });

  await context.close();
  return result;
}

async function runListError(browser) {
  const result = await createNewInquiryPage(browser, 'list-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/consultations/new-inquiry', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '신규상담', exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('상담 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '다시 불러오기' }).first().waitFor();
  await assertNoRawVisibleText(page, 'new inquiry list error');
  await assertNoHorizontalOverflow(page, 'new inquiry list error');
  await page.screenshot({ path: '/Users/etlab/paca-new-inquiry-list-error.png', fullPage: true });

  await context.close();
  return result;
}

async function runCreateHappyPath(browser) {
  const result = await createNewInquiryPage(browser, 'success');
  const { context, page, state } = result;

  await openCreateDialog(page);
  await page.getByLabel('학생명').fill('김진우');
  await page.getByLabel('연락처').fill('010-9999-0000');
  await selectOption(page, '학년', '고2');
  await selectOption(page, '성별', '남');
  await page.getByLabel('학교', { exact: true }).fill('강남고');
  await page.getByLabel('상담 날짜').fill(TEST_DATE);
  await selectOption(page, '상담 시간', '09:30');
  await page.getByRole('button', { name: '등록', exact: true }).last().click();
  await page.getByText('상담이 등록되었습니다.').waitFor({ timeout: 15000 });

  if (!state.directPayload) throw new Error('direct consultation payload was not sent');
  if (state.directPayload.studentName !== '김진우') {
    throw new Error(`studentName mismatch: ${state.directPayload.studentName}`);
  }
  if (state.directPayload.preferredTime !== '09:30') {
    throw new Error(`preferredTime mismatch: ${state.directPayload.preferredTime}`);
  }

  await assertNoRawVisibleText(page, 'new inquiry create');
  await assertNoHorizontalOverflow(page, 'new inquiry create');
  await page.screenshot({ path: '/Users/etlab/paca-new-inquiry.png', fullPage: true });

  await context.close();
  return result;
}

async function runCreateSaveError(browser) {
  const result = await createNewInquiryPage(browser, 'save-error');
  const { context, page, state } = result;

  await openCreateDialog(page);
  await page.getByLabel('학생명').fill('김진우');
  await page.getByLabel('연락처').fill('010-9999-0000');
  await selectOption(page, '학년', '고2');
  await page.getByLabel('상담 날짜').fill(TEST_DATE);
  await selectOption(page, '상담 시간', '09:30');
  await page.getByRole('button', { name: '등록', exact: true }).last().click();
  await page.getByText('신규상담 등록에 실패했습니다. 잠시 후 다시 시도해주세요.').waitFor({ timeout: 15000 });

  if (!state.directPayload) throw new Error('direct consultation payload was not sent before save error');

  await assertNoRawVisibleText(page, 'new inquiry save error');
  await assertNoHorizontalOverflow(page, 'new inquiry save error');
  await page.screenshot({ path: '/Users/etlab/paca-new-inquiry-save-error.png', fullPage: true });

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
    const listError = await runListError(browser);
    const missingHours = await runMissingHours(browser);
    const createHappyPath = await runCreateHappyPath(browser);
    const createSaveError = await runCreateSaveError(browser);
    [listError, missingHours, createHappyPath, createSaveError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      listErrorHits: listError.state.hits,
      missingHoursHits: missingHours.state.hits,
      createHits: createHappyPath.state.hits,
      saveErrorHits: createSaveError.state.hits,
      directPayload: createHappyPath.state.directPayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
