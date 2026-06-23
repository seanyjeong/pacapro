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

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const today = formatDate(new Date());

const season = {
  id: 88,
  academy_id: 1,
  season_name: '2026 정시 집중반',
  season_type: 'regular',
  season_start_date: '2026-07-01',
  season_end_date: '2026-12-10',
  non_season_end_date: '2026-06-30',
  operating_days: [1, 3, 5],
  grade_time_slots: { 고3: ['afternoon', 'evening'], N수: ['morning', 'evening'] },
  default_season_fee: '1500000',
  allows_continuous: true,
  continuous_to_season_type: 'early',
  continuous_discount_type: 'rate',
  continuous_discount_rate: 20,
  status: 'active',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const initialStudents = [
  {
    id: 501,
    student_id: 1,
    season_id: 88,
    student_name: '강하준',
    student_number: 'S-001',
    student_grade: '고3',
    season_fee: '1400000',
    registration_date: '2026-06-20',
    prorated_month: null,
    prorated_amount: null,
    prorated_details: null,
    is_continuous: false,
    previous_season_id: null,
    discount_type: 'custom',
    discount_amount: '100000',
    final_fee: '1400000',
    status: 'registered',
    payment_status: 'paid',
    registered_at: '2026-06-20T09:00:00Z',
    notes: null,
    time_slots: ['evening'],
  },
  {
    id: 502,
    student_id: 2,
    season_id: 88,
    student_name: '윤서아',
    student_number: 'S-002',
    student_grade: 'N수',
    season_fee: '1500000',
    registration_date: '2026-06-21',
    prorated_month: null,
    prorated_amount: null,
    prorated_details: null,
    is_continuous: false,
    previous_season_id: null,
    discount_type: null,
    discount_amount: null,
    final_fee: '1500000',
    status: 'registered',
    payment_status: 'pending',
    registered_at: '2026-06-21T09:00:00Z',
    notes: null,
    time_slots: '["morning"]',
  },
];

function makeRefundPreview() {
  return {
    enrollment: {
      id: 501,
      student_name: '강하준',
      season_name: '2026 정시 집중반',
      season_start_date: '2026-07-01',
      season_end_date: '2026-12-10',
      original_fee: 1500000,
      discount_amount: 100000,
      paid_amount: 1400000,
      payment_status: 'paid',
    },
    cancellation_date: today,
    refund: {
      paidAmount: 1400000,
      originalFee: 1500000,
      discountAmount: 100000,
      totalClassDays: 60,
      attendedDays: 10,
      remainingDays: 50,
      progressRate: '16.7',
      usedAmount: 500000,
      usedRate: '35.7',
      refundAmount: 900000,
      refundRate: '64.3',
      includeVat: false,
      vatAmount: 90000,
      refundAfterVat: 810000,
      legalRefundRate: '66.7',
      legalRefundReason: '수업 진행 1/3 미만',
      legalRefundAmount: 933333,
      finalRefundAmount: 900000,
      calculationDetails: {
        paidAmount: '1,400,000원',
        perClassFee: '25,000원',
        usedFormula: '10회 이용',
        refundFormula: '남은 수업 기준',
        vatFormula: null,
      },
    },
    academy: { academy_name: 'P-ACA 일산', phone: '010-0000-0000', address: '고양시' },
  };
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
    state.hits.push(`${method} ${path}`);

    if (state.failLoad && method === 'GET' && path === '/seasons/88') {
      return jsonRoute(route, { message: 'DB timeout 500 stack trace' }, 500);
    }
    if (method === 'GET' && path === '/seasons/88') {
      return jsonRoute(route, { message: 'ok', season, enrolled_students: state.students });
    }
    if (method === 'GET' && path === '/seasons') {
      return jsonRoute(route, { message: 'ok', seasons: [] });
    }
    if (method === 'GET' && path === '/seasons/88/students') {
      return jsonRoute(route, { enrolled_students: state.students });
    }
    if (method === 'DELETE' && path === '/seasons/88') {
      state.deletedSeasonId = 88;
      return jsonRoute(route, { message: 'deleted' });
    }
    if (method === 'PUT' && path === '/seasons/enrollments/501') {
      state.timeSlotPayload = request.postDataJSON();
      state.students = state.students.map((student) =>
        student.id === 501 ? { ...student, time_slots: state.timeSlotPayload.time_slots } : student
      );
      return jsonRoute(route, { message: 'updated' });
    }
    if (method === 'DELETE' && path === '/seasons/88/students/2') {
      state.cancelledStudentId = 2;
      state.students = state.students.filter((student) => student.student_id !== 2);
      return jsonRoute(route, { message: 'cancelled' });
    }
    if (method === 'POST' && path === '/seasons/enrollments/501/refund-preview') {
      state.refundPreviewPayload = request.postDataJSON();
      return jsonRoute(route, makeRefundPreview());
    }
    if (method === 'POST' && path === '/seasons/enrollments/501/cancel') {
      state.refundCancelPayload = request.postDataJSON();
      state.students = state.students.filter((student) => student.id !== 501);
      return jsonRoute(route, { message: 'cancelled', refundCalculation: makeRefundPreview().refund });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

function makeState(overrides = {}) {
  return { deletedSeasonId: null, externalContinues: [], hits: [], students: structuredClone(initialStudents), ...overrides };
}

async function runNormal(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/88', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '2026 정시 집중반' }).waitFor();
  const enrollHref = await page.getByRole('link', { name: '2026 정시 집중반 학생 등록' }).getAttribute('href');
  if (enrollHref !== '/seasons/88/enroll') {
    throw new Error(`season detail enroll href mismatch: ${enrollHref}`);
  }
  const studentDetailLink = page.getByRole('link', { name: '강하준 학생 상세' }).first();
  await studentDetailLink.waitFor();
  const studentHref = await studentDetailLink.getAttribute('href');
  if (studentHref !== '/students/1') {
    throw new Error(`season detail student href mismatch: ${studentHref}`);
  }
  await assertNoRawVisibleText(page, 'season detail desktop');
  await assertNoHorizontalOverflow(page, 'season detail desktop');
  await page.screenshot({ path: '/Users/etlab/paca-season-detail-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  const enrolledSection = page.getByTestId('enrolled-students-section');
  await enrolledSection.scrollIntoViewIfNeeded();
  await page.getByTestId('enrolled-student-card').first().waitFor();
  await page.getByTestId('enrolled-student-card').first().getByRole('link', { name: '강하준 학생 상세' }).waitFor();
  await assertNoRawVisibleText(page, 'season detail mobile');
  await assertNoHorizontalOverflow(page, 'season detail mobile');
  await enrolledSection.screenshot({ path: '/Users/etlab/paca-season-detail-mobile.png' });

  await page.setViewportSize({ width: 1365, height: 900 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '2026 정시 집중반' }).waitFor();

  await page.locator('tr:has-text("강하준")').getByRole('button', { name: '오전' }).click();
  await page.getByText('시간대가 변경되었습니다.').waitFor();
  if (!state.timeSlotPayload?.time_slots?.includes('morning')) {
    throw new Error(`unexpected time slot payload ${JSON.stringify(state.timeSlotPayload)}`);
  }

  await page.locator('tr:has-text("윤서아")').getByRole('button', { name: '취소' }).click();
  await page.getByRole('alertdialog', { name: '시즌 등록 취소' }).waitFor();
  await page.getByRole('alertdialog', { name: '시즌 등록 취소' }).getByRole('button', { name: '등록 취소' }).click();
  await page.getByText('시즌 등록이 취소되었습니다.').first().waitFor();
  if (state.cancelledStudentId !== 2) throw new Error('pending enrollment cancel endpoint not called');

  await page.locator('tr:has-text("강하준")').getByRole('button', { name: '환불' }).click();
  await page.getByRole('button', { name: '환불 확정' }).waitFor();
  if (state.refundPreviewPayload?.include_vat !== false || state.refundPreviewPayload?.cancellation_date !== today) {
    throw new Error(`unexpected refund preview payload ${JSON.stringify(state.refundPreviewPayload)}`);
  }
  await page.getByRole('button', { name: '환불 확정' }).click();
  await page.getByText('시즌 등록이 취소되었습니다.').first().waitFor();
  if (state.refundCancelPayload?.final_refund_amount !== 900000) {
    throw new Error(`unexpected refund cancel payload ${JSON.stringify(state.refundCancelPayload)}`);
  }

  await page.getByRole('button', { name: '삭제' }).click();
  await page.getByRole('alertdialog', { name: '시즌 삭제' }).waitFor();
  await page.getByRole('alertdialog', { name: '시즌 삭제' }).getByRole('button', { name: '삭제' }).click();
  await page.waitForURL('**/seasons');
  if (state.deletedSeasonId !== 88) throw new Error('season detail delete endpoint not called');

  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  await page.goto('/seasons/88', { waitUntil: 'networkidle' });
  await page.getByText('시즌 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'season detail error');
  await assertNoHorizontalOverflow(page, 'season detail error');
  await page.screenshot({ path: '/Users/etlab/paca-season-detail-error-mobile.png', fullPage: true });

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
    const loadError = await runLoadError(browser);
    [normal, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      normalHits: normal.state.hits,
      timeSlotPayload: normal.state.timeSlotPayload,
      cancelledStudentId: normal.state.cancelledStudentId,
      refundPreviewPayload: normal.state.refundPreviewPayload,
      refundCancelPayload: normal.state.refundCancelPayload,
      normalConsoleErrors: normal.diagnostics.consoleErrors,
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
