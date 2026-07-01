import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createDiagnostics,
  jsonRoute,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

const BASE_URL = process.env.PACA_SMOKE_BASE_URL || 'http://localhost:3109';
const SLUG = 'ilsan';
const RESERVATION_NUMBER = 'R-2026-0001';

const pageInfo = {
  academy: { id: 1, name: 'P-ACA 일산', slug: SLUG },
  settings: {
    pageTitle: '상담 예약',
    pageDescription: '방문 상담 일정을 선택해주세요.',
    slotDuration: 30,
    advanceDays: 30,
    referralSources: ['블로그/인터넷 검색', '지인 소개', 'SNS'],
  },
  weeklyHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isAvailable: dayOfWeek !== 0,
    startTime: '10:00:00',
    endTime: '20:00:00',
  })),
};

function nextAvailableDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function makeState(overrides = {}) {
  return { applyPayloads: [], externalContinues: [], hits: [], reservationPayloads: [], ...overrides };
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

    if (state.failPageInfo && method === 'GET' && path === `/public/consultation/${SLUG}`) {
      return jsonRoute(route, { error: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'GET' && path === `/public/consultation/${SLUG}`) {
      return jsonRoute(route, pageInfo);
    }
    if (state.failSlots && method === 'GET' && path === `/public/consultation/${SLUG}/slots`) {
      return jsonRoute(route, { error: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'GET' && path === `/public/consultation/${SLUG}/slots`) {
      return jsonRoute(route, {
        date: url.searchParams.get('date'),
        slotDuration: 30,
        slots: [
          { time: '14:00:00', available: true },
          { time: '14:30:00', available: false, reason: 'fully_booked' },
          { time: '15:00:00', available: true },
        ],
      });
    }
    if (method === 'GET' && path === `/public/reservation/${RESERVATION_NUMBER}`) {
      return jsonRoute(route, {
        id: 701,
        reservationNumber: RESERVATION_NUMBER,
        studentName: '김민서',
        studentGrade: '고3',
        preferredDate: nextAvailableDate(),
        preferredTime: '14:00',
        status: 'confirmed',
        academyName: 'P-ACA 일산',
        academySlug: SLUG,
      });
    }
    if (method === 'PUT' && path === `/public/reservation/${RESERVATION_NUMBER}`) {
      const payload = request.postDataJSON();
      state.reservationPayloads.push(payload);
      if (state.failReservationUpdate) {
        return jsonRoute(route, { error: 'HTTP 500 DB stack trace' }, 500);
      }
      return jsonRoute(route, { message: '예약이 변경되었습니다.' });
    }
    if (state.failApply && method === 'POST' && path === `/public/consultation/${SLUG}/apply`) {
      return jsonRoute(route, { error: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'POST' && path === `/public/consultation/${SLUG}/apply`) {
      const payload = request.postDataJSON();
      state.applyPayloads.push(payload);
      return jsonRoute(route, { message: '상담 신청이 완료되었습니다.', consultationId: 701 }, 201);
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createContext(browser, state, viewport) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  await installRoutes(context, state);
  return context;
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

async function fillInfoStep(page) {
  await page.getByTestId('booking-intake-panel').getByRole('heading', { name: '입력 가이드' }).waitFor();
  await page.getByTestId('booking-intake-panel').getByText('소요 1분').waitFor();
  await page.getByLabel('이름 *').fill('김민서');
  await page.getByLabel('연락처 *').fill('01012345678');
  await page.getByLabel('학년 *').selectOption('고3');
  await page.getByLabel('성별 *').selectOption('female');
  await page.getByLabel('학교 *').fill('일산고등학교');
  await page.getByLabel('내신 평균등급 *').selectOption('3');
  await page.getByLabel('입시 유형 *').selectOption('regular');
  await page.getByLabel('국어 *').selectOption('2');
  await page.getByLabel('수학 *').selectOption('3');
  await page.getByLabel('영어 *').selectOption('2');
  await page.getByLabel('탐구 *').selectOption('4');
  await page.getByLabel('희망 학교').fill('한국체대');
  await page.getByLabel('학원을 알게 된 경로').selectOption('지인 소개');
  await page.getByLabel('문의 내용').fill('정시 상담을 받고 싶습니다.');
  await page.getByTestId('booking-intake-panel').getByText('필수 11/11').waitFor();
  await page.getByRole('button', { name: '다음: 일정 선택' }).click();
}

async function selectSchedule(page) {
  const date = nextAvailableDate();
  await page.getByTestId(`booking-date-${date}`).click();
  await page.getByRole('button', { name: '14:00' }).click();
  await page.getByRole('button', { name: '다음: 확인' }).click();
  return date;
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createContext(browser, state, { width: 1365, height: 900 });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto(`/c/${SLUG}`, { waitUntil: 'networkidle' });
  await page.getByTestId('consultation-booking-workspace').waitFor();
  await page.getByRole('heading', { name: 'P-ACA 일산 상담예약' }).waitFor();
  await assertNoRawVisibleText(page, 'consultation booking desktop');
  await assertNoHorizontalOverflow(page, 'consultation booking desktop');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-booking-desktop.png', fullPage: true });

  await fillInfoStep(page);
  const date = await selectSchedule(page);
  await page.getByText('신청 내용 확인').waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-consultation-booking-confirm-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '상담 신청하기' }).click();
  await page.waitForURL(`**/c/${SLUG}/success`);
  await page.getByTestId('consultation-success-workspace').waitFor();
  await page.getByText('상담 안내 데스크').waitFor();
  await assertNoRawVisibleText(page, 'consultation booking success');
  await assertNoHorizontalOverflow(page, 'consultation booking success');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-booking-success-desktop.png', fullPage: true });

  const payload = state.applyPayloads.at(-1);
  if (!payload) throw new Error('consultation apply endpoint not called');
  if (payload.studentName !== '김민서') throw new Error(`unexpected student name: ${JSON.stringify(payload)}`);
  if (payload.studentPhone !== '010-1234-5678') throw new Error(`unexpected phone: ${JSON.stringify(payload)}`);
  if (payload.studentGrade !== '고3') throw new Error(`unexpected grade: ${JSON.stringify(payload)}`);
  if (payload.gender !== 'female') throw new Error(`unexpected gender: ${JSON.stringify(payload)}`);
  if (payload.schoolGradeAvg !== 3) throw new Error(`unexpected school grade: ${JSON.stringify(payload)}`);
  if (payload.admissionType !== 'regular') throw new Error(`unexpected admission: ${JSON.stringify(payload)}`);
  if (payload.mockTestGrades?.korean !== 2 || payload.mockTestGrades?.exploration !== 4) {
    throw new Error(`unexpected mock grades: ${JSON.stringify(payload)}`);
  }
  if (payload.preferredDate !== date || payload.preferredTime !== '14:00') {
    throw new Error(`unexpected schedule: ${JSON.stringify(payload)}`);
  }

  await context.close();
  return { state, diagnostics };
}

async function runReservationChangeSuccess(browser) {
  const state = makeState();
  const context = await createContext(browser, state, { width: 390, height: 844 });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto(`/consultation/${RESERVATION_NUMBER}`, { waitUntil: 'networkidle' });
  await page.getByTestId('reservation-change-workspace').waitFor();
  await page.getByText('예약 변경 데스크').waitFor();
  await page.getByRole('heading', { name: '상담 예약 변경' }).waitFor();
  await page.getByRole('button', { name: '15:00' }).click();
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '예약 변경하기' }), 'reservation change success');
  await page.getByRole('heading', { name: '예약이 변경되었습니다' }).waitFor();
  const payload = state.reservationPayloads.at(-1);
  if (payload?.preferredTime !== '15:00:00') {
    throw new Error(`reservation change payload mismatch: ${JSON.stringify(payload)}`);
  }
  await assertNoRawVisibleText(page, 'reservation change success');
  await assertNoHorizontalOverflow(page, 'reservation change success');
  await page.screenshot({ path: '/Users/etlab/paca-reservation-change-success-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runReservationChangeError(browser) {
  const state = makeState({ failReservationUpdate: true });
  const context = await createContext(browser, state, { width: 390, height: 844 });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto(`/consultation/${RESERVATION_NUMBER}`, { waitUntil: 'networkidle' });
  await page.getByTestId('reservation-change-workspace').waitFor();
  await page.getByText('예약 변경 데스크').waitFor();
  await page.getByRole('heading', { name: '상담 예약 변경' }).waitFor();
  await page.getByRole('button', { name: '15:00' }).click();
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '예약 변경하기' }), 'reservation change error');
  await page.getByText('예약을 변경하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'reservation change error');
  await assertNoHorizontalOverflow(page, 'reservation change error');
  await page.screenshot({ path: '/Users/etlab/paca-reservation-change-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runMobile(browser) {
  const state = makeState();
  const context = await createContext(browser, state, { width: 390, height: 844 });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto(`/c/${SLUG}`, { waitUntil: 'networkidle' });
  await page.getByTestId('consultation-booking-workspace').waitFor();
  await assertNoRawVisibleText(page, 'consultation booking mobile');
  await assertNoHorizontalOverflow(page, 'consultation booking mobile');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-booking-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runSuccessMobile(browser) {
  const state = makeState();
  const context = await createContext(browser, state, { width: 390, height: 844 });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto(`/c/${SLUG}/success`, { waitUntil: 'networkidle' });
  await page.getByTestId('consultation-success-workspace').waitFor();
  await page.getByText('상담 안내 데스크').waitFor();
  await assertNoRawVisibleText(page, 'consultation booking success mobile');
  await assertNoHorizontalOverflow(page, 'consultation booking success mobile');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-booking-success-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runPageError(browser) {
  const state = makeState({ failPageInfo: true });
  const context = await createContext(browser, state, { width: 390, height: 844 });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto(`/c/${SLUG}`, { waitUntil: 'networkidle' });
  await page.getByText('상담 예약 페이지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'consultation booking page error');
  await assertNoHorizontalOverflow(page, 'consultation booking page error');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-booking-page-error-mobile.png', fullPage: true });

  await context.close();
  return { state, diagnostics };
}

async function runSubmitError(browser) {
  const state = makeState({ failApply: true });
  const context = await createContext(browser, state, { width: 390, height: 844 });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto(`/c/${SLUG}`, { waitUntil: 'networkidle' });
  await page.getByTestId('consultation-booking-workspace').waitFor();
  await fillInfoStep(page);
  await selectSchedule(page);
  await page.getByRole('button', { name: '상담 신청하기' }).click();
  await page.getByText('상담 신청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'consultation booking submit error');
  await assertNoHorizontalOverflow(page, 'consultation booking submit error');
  await page.screenshot({ path: '/Users/etlab/paca-consultation-booking-submit-error-mobile.png', fullPage: true });

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
    const mobile = await runMobile(browser);
    const successMobile = await runSuccessMobile(browser);
    const pageError = await runPageError(browser);
    const submitError = await runSubmitError(browser);
    const reservationSuccess = await runReservationChangeSuccess(browser);
    const reservationError = await runReservationChangeError(browser);
    [normal, mobile, successMobile, pageError, submitError, reservationSuccess, reservationError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      applyPayload: normal.state.applyPayloads.at(-1),
      reservationPayload: reservationSuccess.state.reservationPayloads.at(-1),
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      mobileConsoleErrors: mobile.diagnostics.consoleErrors,
      successMobileConsoleErrors: successMobile.diagnostics.consoleErrors,
      pageErrorConsoleErrors: pageError.diagnostics.consoleErrors,
      reservationErrorConsoleErrors: reservationError.diagnostics.consoleErrors,
      submitErrorConsoleErrors: submitError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
