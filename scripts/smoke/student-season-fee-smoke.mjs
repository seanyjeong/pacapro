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

// 학생 상세 시즌 등록·수정 — 이 학생 시즌비·직접 할인을 고치면 서버 미리보기 금액이 바로 바뀌고,
// 등록은 일할 전 시즌비를 보내며(일할은 서버가 한 번만), 수정은 바꾼 값만 보낸다.

const student = {
  id: 41,
  academy_id: 1,
  name: '김진우',
  student_type: 'exam',
  phone: '010-1111-2222',
  parent_phone: '010-3333-4444',
  school: '일산고',
  grade: '고3',
  class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
  weekly_count: 2,
  monthly_tuition: '520000',
  discount_rate: '0',
  payment_due_day: 5,
  final_monthly_tuition: '520000',
  is_season_registered: true,
  current_season_id: 7,
  status: 'active',
  enrollment_date: '2026-03-04',
  is_trial: false,
  time_slot: 'evening',
  created_at: '2026-02-20T09:00:00.000Z',
  updated_at: '2026-06-22T09:00:00.000Z',
  deleted_at: null,
};

const enrolled = {
  id: 701,
  enrollment_id: 701,
  student_id: 41,
  season_id: 7,
  season_name: '2026 정시 시즌',
  season_fee: '1200000',
  default_season_fee: '1200000',
  season_base_fee: '1200000',
  registration_date: '2026-06-10',
  is_continuous: false,
  previous_season_id: null,
  discount_type: 'none',
  discount_amount: '0',
  discount_reason: null,
  status: 'active',
  payment_status: 'pending',
  final_fee: 1200000,
  paid_amount: 0,
  time_slots: ['evening'],
};

const season = (id, name, start, end, fee) => ({
  id,
  academy_id: 1,
  season_name: name,
  season_type: 'regular',
  season_start_date: start,
  season_end_date: end,
  non_season_end_date: null,
  operating_days: [1, 3, 5],
  grade_time_slots: { 고3: ['evening'] },
  default_season_fee: fee,
  allows_continuous: false,
  continuous_discount_type: 'none',
  continuous_discount_rate: 0,
  status: 'active',
});

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== 'supermax.kr') return route.continue();
    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/students/41') {
      return jsonRoute(route, { message: 'ok', payments: [], performances: [], student });
    }
    if (method === 'GET' && path === '/students/41/seasons') {
      return jsonRoute(route, { message: 'ok', seasons: [enrolled] });
    }
    if (method === 'GET' && path === '/seasons/registerable') {
      return jsonRoute(route, {
        message: 'ok',
        seasons: [
          season(7, '2026 정시 시즌', '2026-07-01', '2026-10-30', '1200000'),
          season(8, '2026 겨울 시즌', '2026-11-23', '2027-01-29', '1500000'),
        ],
      });
    }
    if (method === 'GET' && path === '/seasons/8/preview') {
      // 서버 미리보기 흉내 — 시즌 도중 합류 80% 일할 후 직접 할인
      const fee = Number(url.searchParams.get('season_fee'));
      const discount = Number(url.searchParams.get('discount_amount') || 0);
      const prorated = Math.floor((fee * 0.8) / 1000) * 1000;
      state.previewQueries.push(url.search);
      return jsonRoute(route, {
        message: 'ok',
        preview: {
          mid_season_prorated: {
            is_mid_season: true,
            original_fee: fee,
            prorated_fee: prorated,
            discount: fee - prorated,
            total_days: 50,
            remaining_days: 40,
            details: '40/50일',
          },
          non_season_prorated_info: null,
          final_calculation: {
            season_fee: prorated,
            original_season_fee: fee,
            mid_season_discount: fee - prorated,
            prorated_fee: 0,
            discount_amount: 0,
            manual_discount: discount,
            total_due: Math.max(0, prorated - discount),
          },
        },
      });
    }
    if (method === 'POST' && path === '/seasons/8/enroll') {
      state.enrollPayload = request.postDataJSON();
      return jsonRoute(route, { message: 'ok', enrollment: { ...enrolled, id: 702, season_id: 8 } }, 201);
    }
    if (method === 'PUT' && path === '/seasons/enrollments/701') {
      state.editPayload = request.postDataJSON();
      state.editAttempts += 1;
      if (state.editAttempts === 1) return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      if (state.editAttempts === 2) {
        return jsonRoute(route, { error: 'Conflict', message: '이미 낸 돈이 있는 시즌비 청구라 금액을 바꾸지 않았습니다. 청구 금액은 결제 화면에서 고쳐 주세요.' }, 409);
      }
      return jsonRoute(route, { message: 'updated', enrollment: { ...enrolled, season_fee: '1150000' } });
    }
    return jsonRoute(route, { message: 'mocked' });
  });
}

async function main() {
  const browser = await launchSmokeBrowser();
  const state = { hits: [], previewQueries: [], enrollPayload: null, editPayload: null, editAttempts: 0 };
  try {
    const context = await createAuthedContext(browser, { width: 1365, height: 900 });
    await installRoutes(context, state);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const diagnostics = createDiagnostics(page);

    await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '학생 상세' }).waitFor();
    await page.getByRole('button', { name: '시즌 등록 보기' }).click();
    await page.getByRole('heading', { name: '시즌 등록 현황' }).waitFor();

    await page.getByRole('button', { name: '시즌 등록', exact: true }).click();
    await page.getByRole('heading', { name: '시즌 등록', exact: true }).waitFor();
    await page.locator('select').selectOption('8');
    await page.locator('input[type="date"]').fill('2026-12-01');
    await page.getByLabel('이 학생 시즌비').fill('1400000');
    await page.getByLabel('직접 할인').fill('100000');
    await page.getByText('1,020,000원').waitFor();
    await page.screenshot({ path: '/Users/etlab/paca-student-season-enroll-fee.png', fullPage: true });
    await page.locator('div.fixed.inset-0').getByRole('button', { name: '등록', exact: true }).click();
    await page.getByText('시즌 등록이 완료되었습니다.').waitFor();

    const enroll = state.enrollPayload;
    if (enroll?.season_fee !== 1400000 || enroll?.discount_amount !== 100000 || enroll?.registration_date !== '2026-12-01') {
      throw new Error(`unexpected season enroll payload: ${JSON.stringify(enroll)}`);
    }
    if (!state.previewQueries.some((query) => query.includes('season_fee=1400000') && query.includes('registration_date=2026-12-01'))) {
      throw new Error(`season preview did not use edited fee: ${JSON.stringify(state.previewQueries)}`);
    }

    await page.getByRole('button', { name: '시즌 등록 수정' }).click();
    await page.getByRole('heading', { name: '시즌 등록 정보 수정' }).waitFor();
    await page.getByLabel('직접 할인').fill('50000');
    await page.getByLabel('할인 사유').fill('형제 할인');
    // 서버 오류는 원문을 숨기고, 낸 돈이 있어 막힌 경우는 서버 안내를 그대로 보여 준다
    await page.getByRole('button', { name: '저장' }).click();
    await page.getByRole('alert').getByText('시즌 등록 정보를 수정하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
    await page.getByRole('button', { name: '저장' }).click();
    await page.getByRole('alert').getByText('결제 화면에서 고쳐 주세요', { exact: false }).waitFor();
    await page.getByRole('button', { name: '저장' }).click();
    await page.getByText('시즌 등록 정보가 수정되었습니다.').waitFor();
    await page.getByText('청구 금액 1,150,000원').waitFor();
    if (JSON.stringify(state.editPayload) !== JSON.stringify({ discount_amount: 50000, discount_reason: '형제 할인' })) {
      throw new Error(`unexpected season edit payload: ${JSON.stringify(state.editPayload)}`);
    }

    await assertNoRawVisibleText(page, 'student season fee');
    await assertNoHorizontalOverflow(page, 'student season fee');
    const pageErrors = nonServiceWorkerErrors(diagnostics.pageErrors);
    if (pageErrors.length) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
    await context.close();
    console.log(JSON.stringify({ previewQueries: state.previewQueries, enroll, edit: state.editPayload }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
