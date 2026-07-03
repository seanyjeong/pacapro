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

const PHOTO_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

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
    age: null,
    address: '경기 고양시 일산동구',
    admission_type: 'regular',
    profile_image_url: '/students/41/photo/thumb',
    profile_image_key: 'academies/1/students/41/profile-original.png',
    profile_thumb_key: 'academies/1/students/41/profile-thumb.png',
    profile_image_updated_at: '2026-07-03T10:00:00.000Z',
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
    rest_start_date: null,
    rest_end_date: null,
    rest_reason: null,
    enrollment_date: '2026-03-04',
    withdrawal_date: null,
    notes: '정시 준비 집중 관리',
    is_trial: false,
    trial_remaining: null,
    trial_dates: null,
    time_slot: 'evening',
    memo: null,
    class_days_next: null,
    class_days_effective_from: null,
    consultation_date: '2026-02-20',
    academy_name: 'PACA 일산',
    created_at: '2026-02-20T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    deleted_at: null,
  };
}

function makePayment() {
  return {
    id: 501,
    student_id: 41,
    student_name: '김진우',
    year_month: '2026-06',
    base_amount: '520000',
    discount_amount: '52000',
    final_amount: '468000',
    paid_amount: '0',
    remaining_amount: '348000',
    payment_status: 'partial',
    payment_method: 'account',
    paid_date: '2026-06-10',
    due_date: '2026-06-05',
    notes: '분납 예정',
    created_at: '2026-06-01T09:00:00.000Z',
  };
}

function makeSeasonEnrollment() {
  return {
    id: 701,
    student_id: 41,
    season_id: 7,
    season_name: '2026 정시 시즌',
    season_fee: '1200000',
    registration_date: '2026-06-10',
    prorated_month: '2026-06',
    prorated_amount: '840000',
    prorated_details: null,
    is_continuous: false,
    previous_season_id: null,
    discount_type: null,
    discount_amount: '0',
    final_fee: '1200000',
    status: 'registered',
    payment_status: 'pending',
    registered_at: '2026-06-10T09:00:00.000Z',
    notes: null,
    time_slots: ['evening'],
  };
}

function makeManualCredit() {
  return {
    id: 901,
    student_id: 41,
    academy_id: 1,
    source_payment_id: null,
    rest_start_date: '2026-06-12',
    rest_end_date: '2026-06-19',
    rest_days: 2,
    credit_amount: 78000,
    remaining_amount: 78000,
    credit_type: 'manual',
    status: 'pending',
    applied_to_payment_id: null,
    created_at: '2026-06-12T09:00:00.000Z',
    processed_at: null,
    notes: '휴원 기간 이월',
  };
}

function makeState(mode) {
  const manualCredits = [makeManualCredit()];
  return {
    hits: [],
    manualCreditDeleted: false,
    manualCredits,
    mode,
    payment: makePayment(),
    recalculated: false,
    seasonCancelled: false,
    seasonEnrollments: [makeSeasonEnrollment()],
    student: makeStudent(),
    withdrawPayload: null,
  };
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
    if (method === 'GET' && path === '/students/41/photo/thumb') return fulfillPhoto(route);
    if (method === 'GET' && path === '/students/41') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        message: 'ok',
        payments: [state.payment],
        performances: [],
        student: state.student,
      });
    }
    if (method === 'GET' && path === '/students/41/rest-credits') {
      const pendingTotal = state.manualCredits.reduce((sum, credit) => sum + credit.remaining_amount, 0);
      return jsonRoute(route, { credits: state.manualCredits, message: 'ok', pendingTotal });
    }
    if (method === 'GET' && path === '/students/41/credits') {
      return jsonRoute(route, { credits: state.manualCredits, message: 'ok' });
    }
    if (method === 'DELETE' && path === '/students/41/credits/901') {
      state.manualCreditDeleted = true;
      state.manualCredits = [];
      return jsonRoute(route, { message: '크레딧이 삭제되었습니다.' });
    }
    if (method === 'GET' && path === '/students/41/seasons') {
      return jsonRoute(route, { message: 'ok', seasons: state.seasonEnrollments });
    }
    if (method === 'GET' && path === '/seasons/registerable') {
      return jsonRoute(route, {
        message: 'ok',
        seasons: [
          {
            id: 7,
            academy_id: 1,
            season_name: '2026 정시 시즌',
            season_type: 'regular',
            season_start_date: '2026-07-01',
            season_end_date: '2026-12-31',
            non_season_end_date: '2026-06-30',
            operating_days: [1, 3, 5],
            grade_time_slots: { 고3: ['evening'] },
            default_season_fee: '1200000',
            allows_continuous: true,
            continuous_to_season_type: null,
            continuous_discount_type: 'none',
            continuous_discount_rate: 0,
            status: 'active',
            created_at: '2026-06-01T09:00:00.000Z',
            updated_at: '2026-06-01T09:00:00.000Z',
          },
        ],
      });
    }
    if (method === 'DELETE' && path === '/seasons/7/students/41') {
      state.seasonCancelled = true;
      state.seasonEnrollments = state.seasonEnrollments.map((enrollment) => ({
        ...enrollment,
        status: 'cancelled',
        payment_status: 'cancelled',
      }));
      return jsonRoute(route, { message: '시즌 등록이 취소되었습니다.' });
    }

    if (method === 'PUT' && path === '/seasons/enrollments/701') {
      if (state.mode === 'season-edit-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'updated', enrollment: makeSeasonEnrollment() });
    }

    if (method === 'GET' && path === '/students/41/attendance') {
      if (state.mode === 'attendance-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }

      return jsonRoute(route, {
        records: [
          { attendance_status: 'present', date: '2026-06-03', is_makeup: false, notes: null, time_slot: 'evening' },
          { attendance_status: 'late', date: '2026-06-05', is_makeup: false, notes: '10분 지각', time_slot: 'evening' },
        ],
        student_id: 41,
        summary: { absent: 0, attendance_rate: 50, excused: 0, late: 1, makeup: 0, present: 1, total: 2 },
        year_month: url.searchParams.get('year_month') || '2026-06',
      });
    }

    if (method === 'POST' && path === '/students/41/recalculate-first-payment') {
      state.recalculated = true;
      return jsonRoute(route, {
        message: '첫 달 학원비를 다시 계산했습니다.',
        payment: {
          id: 501,
          year_month: '2026-06',
          base_amount: 520000,
          discount_amount: 52000,
          due_date: '2026-06-05',
          final_amount: 468000,
        },
      });
    }

    if (method === 'POST' && path === '/students/41/withdraw') {
      const payload = JSON.parse(request.postData() || '{}');
      state.withdrawPayload = payload;
      state.student = {
        ...state.student,
        rest_end_date: null,
        rest_reason: null,
        rest_start_date: null,
        status: 'withdrawn',
        withdrawal_date: payload.withdrawal_date || '2026-06-23',
      };
      return jsonRoute(route, {
        message: 'withdrawn',
        student: {
          id: 41,
          name: '김진우',
          status: 'withdrawn',
          withdrawal_date: state.student.withdrawal_date,
          withdrawal_reason: payload.reason || null,
        },
      });
    }

    if (method === 'DELETE' && path === '/students/41') {
      return jsonRoute(route, { message: 'deleted', student: { id: 41, name: '김진우' } });
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

async function createStudentDetailPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, page, state, diagnostics };
}

async function runNormalDesktop(browser) {
  const result = await createStudentDetailPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor({ timeout: 15000 });
  await page.getByText('김진우').first().waitFor();
  await page.waitForFunction(() => Array.from(document.images).some((image) => image.complete && image.naturalWidth > 0));
  if (!state.hits.some((hit) => hit.startsWith('GET /students/41/photo/thumb'))) {
    throw new Error('student profile photo was not requested on detail page');
  }
  await page.getByText('S-2026-041').waitFor();
  await page.locator('section').filter({ hasText: /^실납부\s*468,000원/ }).waitFor();
  await page.getByText('수업 및 학원비', { exact: true }).waitFor();
  await page.locator('section').filter({ hasText: '수업 및 학원비' }).getByText('매월 5일 납부').waitFor();
  await page.getByText('연락처', { exact: true }).waitFor();
  await page.getByText('기타 정보', { exact: true }).waitFor();
  await page.getByRole('heading', { name: '학생 작업 보드' }).waitFor();
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '수업/학원비 변경' }).waitFor();
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '수업일 변경' }).waitFor();
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '문자 발송' }).waitFor();
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '납부 내역' }).waitFor();
  await page.getByText('2026-06', { exact: true }).waitFor();
  if (await page.getByText('개발 중').count()) {
    throw new Error('student detail exposes internal development copy');
  }
  await assertNoRawVisibleText(page, 'student detail desktop');
  await assertNoHorizontalOverflow(page, 'student detail desktop');
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-desktop.png', fullPage: true });

  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '납부 내역' }).click();
  await page.getByText('2026-06', { exact: true }).waitFor();
  await page.getByText('468,000원').first().waitFor();
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '첫 달 일할 재계산' }), 'first payment recalculation');
  await page.getByRole('alertdialog').getByRole('heading', { name: '첫 달 일할 재계산' }).waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-recalculate-dialog.png', fullPage: true });
  await page.getByRole('button', { name: '재계산 실행' }).click();
  await page.getByText('2026-06', { exact: true }).waitFor();
  if (!state.recalculated) throw new Error('first payment recalculation API was not called');

  await page.getByRole('button', { name: '크레딧 추가' }).click();
  await page.getByRole('heading', { name: '크레딧 관리' }).waitFor();
  await page.getByRole('button', { name: '크레딧 목록' }).click();
  await page.getByText('휴원 기간 이월').first().waitFor();
  const deleteCreditButton = page.getByRole('button', { name: '크레딧 삭제' });
  await clickWithoutNativeDialog(page, deleteCreditButton, 'manual credit deletion');
  await page.getByRole('alertdialog').getByRole('heading', { name: '크레딧 삭제' }).waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-credit-delete-dialog.png', fullPage: true });
  await page.getByRole('button', { name: '삭제' }).click();
  await page.getByText('등록된 크레딧이 없습니다.').last().waitFor();
  if (!state.manualCreditDeleted) throw new Error('manual credit deletion API was not called');
  await page.getByRole('button', { name: '닫기' }).click();

  await page.getByRole('button', { name: '시즌 등록 보기' }).click();
  await page.getByRole('heading', { name: '시즌 등록 현황' }).waitFor();
  await page.getByText('2026 정시 시즌').waitFor();
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '취소' }).first(), 'season enrollment cancellation');
  await page.getByRole('alertdialog').getByRole('heading', { name: '시즌 등록 취소' }).waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-season-cancel-dialog.png', fullPage: true });
  await page.getByRole('button', { name: '등록 취소' }).click();
  await page.getByText('취소됨').waitFor();
  if (!state.seasonCancelled) throw new Error('season cancellation API was not called');

  await clickWithoutNativeDialog(page, page.getByTestId('student-detail-operations-board').getByRole('button', { name: '삭제' }), 'delete action');
  await page.getByRole('alertdialog').getByRole('heading', { name: '학생 삭제' }).waitFor();
  await page.getByRole('button', { name: '취소' }).click();

  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '퇴원 처리' }), 'withdraw action');
  await page.getByRole('alertdialog').getByRole('heading', { name: '퇴원 처리' }).waitFor();
  await page.getByLabel('퇴원 사유').fill('타 학원 이동');
  await page.getByRole('button', { name: '퇴원 처리 완료' }).click();
  await page.getByText('현재 상태: 퇴원').waitFor();
  if (state.withdrawPayload?.reason !== '타 학원 이동') {
    throw new Error(`unexpected withdraw payload: ${JSON.stringify(state.withdrawPayload)}`);
  }

  await context.close();
  return { diagnostics: result.diagnostics, state };
}

async function runNormalMobile(browser) {
  const result = await createStudentDetailPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByText('김진우').first().waitFor();
  await page.getByRole('heading', { name: '학생 작업 보드' }).waitFor();
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '수업/학원비 변경' }).waitFor();
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '수업일 변경' }).waitFor();
  await page.getByText('2026-06', { exact: true }).waitFor();
  await assertNoRawVisibleText(page, 'student detail mobile');
  await assertNoHorizontalOverflow(page, 'student detail mobile');
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-mobile.png', fullPage: true });

  await page.getByRole('button', { name: '시즌 등록 보기' }).click();
  const seasonHeading = page.getByRole('heading', { name: '시즌 등록 현황' });
  await seasonHeading.waitFor();
  await seasonHeading.scrollIntoViewIfNeeded();
  await page.getByText('2026 정시 시즌').waitFor();
  await assertNoRawVisibleText(page, 'student detail season mobile');
  await assertNoHorizontalOverflow(page, 'student detail season mobile');
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-season-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runError(browser) {
  const result = await createStudentDetailPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor({ timeout: 15000 });
  await page.getByText('학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '목록으로' }).waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
  await assertNoRawVisibleText(page, 'student detail error');
  await assertNoHorizontalOverflow(page, 'student detail error');
  await page.screenshot({ path: '/Users/etlab/paca-student-detail-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runSeasonEditError(browser) {
  const result = await createStudentDetailPage(browser, 'season-edit-error');
  const { context, page } = result;

  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByRole('button', { name: '시즌 등록 보기' }).click();
  await page.getByRole('heading', { name: '시즌 등록 현황' }).waitFor();
  await page.getByRole('button', { name: '시즌 등록 수정' }).click();
  await page.getByRole('heading', { name: '시즌 등록 정보 수정' }).waitFor();
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByRole('alert').getByText('시즌 등록 정보를 수정하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'student detail season edit error');
  await assertNoHorizontalOverflow(page, 'student detail season edit error');
  await page.screenshot({ path: '/Users/etlab/paca-student-season-edit-error.png', fullPage: true });

  await context.close();
  return result;
}

async function runAttendanceError(browser) {
  const result = await createStudentDetailPage(browser, 'attendance-error', { width: 390, height: 844 });
  const { context, page } = result;
  await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByTestId('student-detail-operations-board').getByRole('button', { name: '출결 현황' }).click();
  await page.getByText('출결 데이터를 불러올 수 없습니다.').waitFor();
  await page.waitForTimeout(300);
  if (await page.getByText('요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.').count()) {
    throw new Error('attendance error should stay inline without a duplicate global toast');
  }
  await assertNoRawVisibleText(page, 'student detail attendance error');
  await assertNoHorizontalOverflow(page, 'student detail attendance error');
  await page.screenshot({ path: '/Users/etlab/paca-student-attendance-error-mobile.png', fullPage: true });
  await context.close();
  return result;
}
function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}
const fulfillPhoto = (route) => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(PHOTO_PNG_BASE64, 'base64') });
async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const desktop = await runNormalDesktop(browser);
    const mobile = await runNormalMobile(browser);
    const error = await runError(browser);
    const seasonEditError = await runSeasonEditError(browser);
    const attendanceError = await runAttendanceError(browser);
    [desktop, mobile, error, seasonEditError, attendanceError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      attendanceErrorHits: attendanceError.state.hits,
      desktopHits: desktop.state.hits,
      errorConsoleErrors: error.diagnostics.consoleErrors,
      errorHits: error.state.hits,
      mobileHits: mobile.state.hits,
      normalConsoleErrors: desktop.diagnostics.consoleErrors,
      seasonEditErrorHits: seasonEditError.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
