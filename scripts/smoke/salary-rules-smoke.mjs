import { mkdirSync } from 'node:fs';
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

const CAPTURE_DIR = process.env.PACA_SMOKE_CAPTURE_DIR;
if (CAPTURE_DIR) mkdirSync(CAPTURE_DIR, { recursive: true });

const ALL = ['morning', 'afternoon', 'evening'];
const instructors = [
  { id: 319, name: '강연요', status: 'active', salary_type: 'per_class', instructor_type: 'teacher', hourly_rate: '35000', base_salary: '0', tax_type: 'none' },
  { id: 2, name: '오철민', status: 'active', salary_type: 'monthly', instructor_type: 'teacher', hourly_rate: '0', base_salary: '1200000', tax_type: '3.3%' },
];
const season = {
  id: 21, academy_id: 2, season_name: '2027 정시집중', season_type: 'regular', season_start_date: '2026-11-23', season_end_date: '2027-01-31', non_season_end_date: '2026-11-20',
  operating_days: [0, 1, 2, 3, 4, 5], grade_time_slots: null, default_season_fee: '3700000', allows_continuous: false, continuous_discount_type: 'none', continuous_discount_rate: 0, status: 'active',
};

function makeState() {
  return {
    posts: [],
    rules: [],
    adjustments: [],
    salary: {
      id: 154, instructor_id: 319, instructor_name: '강연요', year_month: '2026-11', salary_type: 'per_class', hourly_rate: '35000', base_amount: 315000, incentive_amount: 0,
      total_deduction: 0, tax_type: 'none', tax_amount: 0, net_salary: 315000, adjustment_amount: 0, adjustment_count: 0, base_override: null, payment_status: 'pending', payment_date: null,
      calculation_details: { base_lines: [
        { kind: 'class', label: '수업당 35,000원 × 9회 (11/2~11/20)', amount: 315000 },
        { kind: 'excluded', label: '정시 시즌 고정급 규칙 적용 7회 (11/23~11/25, 시간대 무관)', amount: 0 },
      ] },
    },
  };
}

function settle(state) {
  const sum = state.adjustments.reduce((total, item) => total + item.amount, 0);
  Object.assign(state.salary, { adjustment_amount: sum, adjustment_count: state.adjustments.length, net_salary: state.salary.base_amount + sum });
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== 'supermax.kr') return route.continue();
    const method = request.method();
    const path = normalizePacaApiPath(url);
    const body = ['POST', 'PUT'].includes(method) && request.postData() ? request.postDataJSON() : null;
    if (body) state.posts.push({ method, path, body });

    if (method === 'GET' && path === '/salaries/154') return jsonRoute(route, { salary: state.salary, adjustments: state.adjustments, attendance_summary: null });
    if (method === 'GET' && path === '/salaries') return jsonRoute(route, { salaries: [state.salary] });
    if (method === 'POST' && path === '/salaries/open') return jsonRoute(route, { salary: { id: 154 } }, 201);
    if (method === 'PUT' && path === '/salaries/154') {
      state.salary.base_override = body.base_override;
      state.salary.base_amount = body.base_override ?? 315000;
      settle(state);
      return jsonRoute(route, { salary: state.salary });
    }
    const adjustment = path.match(/^\/salaries\/154\/adjustments(?:\/(\d+))?$/);
    if (adjustment) {
      if (method === 'POST') state.adjustments.push({ id: state.adjustments.length + 1, ...body });
      if (method === 'PUT') Object.assign(state.adjustments.find((item) => item.id === Number(adjustment[1])), body);
      if (method === 'DELETE') state.adjustments = state.adjustments.filter((item) => item.id !== Number(adjustment[1]));
      settle(state);
      return jsonRoute(route, { adjustments: state.adjustments });
    }
    if (method === 'GET' && path === '/pay-rules') return jsonRoute(route, { rules: state.rules });
    if (method === 'POST' && path === '/pay-rules/season/21/sync') {
      for (const id of body.rule_ids) Object.assign(state.rules.find((rule) => rule.id === id), { start_date: season.season_start_date, end_date: season.season_end_date });
      return jsonRoute(route, { message: 'ok' });
    }
    if (method === 'POST' && path.startsWith('/pay-rules')) {
      const total = (body.installments ?? []).reduce((sum, item) => sum + item.amount, 0);
      if (body.pay_type === 'fixed_total' && total !== body.amount && !body.confirm_mismatch) return jsonRoute(route, { error: 'INSTALLMENT_MISMATCH', message: '분할 합계가 다릅니다.' }, 409);
      for (const id of body.instructor_ids ?? [body.instructor_id]) {
        state.rules.push({ ...body, id: state.rules.length + 1, instructor_id: id, instructor_name: instructors.find((item) => item.id === id).name,
          season_id: path.includes('season') ? 21 : null, season_name: path.includes('season') ? season.season_name : null, installments: body.installments ?? [] });
      }
      return jsonRoute(route, { message: 'ok' }, 201);
    }
    if (method === 'GET' && path === '/instructors') return jsonRoute(route, { instructors });
    if (method === 'GET' && path === '/instructors/319') return jsonRoute(route, { instructor: instructors[0], attendances: [], salaries: [] });
    if (method === 'GET' && path === '/seasons/21') return jsonRoute(route, { season });
    if (method === 'GET' && path === '/seasons/21/students') return jsonRoute(route, { enrolled_students: [] });
    return jsonRoute(route, {});
  });
}

async function check(page, name) {
  await assertNoRawVisibleText(page, name);
  await assertNoHorizontalOverflow(page, name);
  if (CAPTURE_DIR) await page.screenshot({ path: `${CAPTURE_DIR}/${name}.png` });
}

function expectEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}

async function runSalary(page, state) {
  await page.goto('/salaries/154', { waitUntil: 'networkidle' });
  await page.getByText('정시 시즌 고정급 규칙 적용 7회 (11/23~11/25, 시간대 무관)').waitFor();

  await page.getByRole('button', { name: '조정 추가' }).click();
  await page.getByLabel('항목명').fill('지각 차감');
  await page.getByRole('button', { name: '빼기' }).click();
  await page.getByLabel('금액', { exact: true }).fill('30000');
  await page.getByLabel('메모').fill('11/13');
  await check(page, '1-adjustment-dialog');
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click();
  await page.getByTestId('salary-adjustments').getByText('-30,000원').waitFor();
  expectEqual(state.posts.at(-1).body, { label: '지각 차감', amount: -30000, taxable: true, memo: '11/13' }, 'adjustment payload');

  await page.getByRole('button', { name: '실수령액 맞추기' }).click();
  await page.getByLabel('실수령액', { exact: true }).fill('400000');
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click();
  await page.getByTestId('salary-adjustments').getByText('+115,000원').waitFor();
  expectEqual(state.posts.at(-1).body, { label: '실수령액 맞춤', amount: 115000, taxable: false, memo: null }, 'match payload');
  await check(page, '2-salary-detail');

  await page.getByRole('button', { name: '실수령액 맞춤 삭제' }).click();
  await page.getByText('조정 항목을 삭제했습니다.').waitFor();
  await page.getByRole('button', { name: '기본급 수정' }).click();
  await page.getByLabel('기본급 직접 입력').fill('500000');
  await page.getByRole('button', { name: '기본급 저장' }).click();
  await page.getByText('기본급 (직접 입력)').waitFor();
  expectEqual(state.posts.at(-1).body, { base_override: 500000 }, 'override payload');
  await page.getByRole('button', { name: '기본급 자동 계산으로' }).click();
  await page.getByText('자동 계산으로 되돌렸습니다.').waitFor();
  expectEqual(state.posts.at(-1).body, { base_override: null }, 'override clear payload');

  // 지급 완료면 조정·기본급을 바꿀 수 없다
  state.salary.payment_status = 'paid';
  state.salary.payment_date = '2026-12-10';
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('지급 완료된 급여는 조정할 수 없어요.').waitFor();
  for (const name of ['조정 추가', '실수령액 맞추기', '기본급 수정', '지각 차감 삭제']) {
    if (await page.getByRole('button', { name }).count()) throw new Error(`${name} should be hidden on paid salary`);
  }
  state.salary.payment_status = 'pending';

  await page.goto('/salaries', { waitUntil: 'networkidle' });
  await page.getByRole('table').getByText('조정 1건').waitFor();
  await page.getByRole('button', { name: '명세서 만들기' }).click();
  await page.getByRole('dialog').getByLabel('강사').selectOption('319');
  await page.getByLabel('급여월 (일한 달)').fill('2026-12');
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await page.waitForURL('**/salaries/154');
  expectEqual(state.posts.at(-1), { method: 'POST', path: '/salaries/open', body: { instructor_id: 319, year_month: '2026-12' } }, 'open payload');
}

async function runInstructor(page, state) {
  await page.goto('/instructors/319', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '규칙 추가' }).click();
  await page.getByLabel('규칙 이름').fill('정시 시즌');
  await page.getByLabel('총액').fill('3000000');
  await page.getByLabel('시작하는 날 (비워도 됨)').fill('2026-11-23');
  await page.getByLabel('끝나는 날 (비워도 됨)').fill('2027-01-31');
  await page.getByRole('button', { name: '지급 달 추가' }).click();
  await page.getByLabel('1번째 지급 달').fill('2026-12');
  await page.getByLabel('1번째 지급 금액').fill('1500000');
  await page.getByTestId('pay-rule-mismatch').waitFor();
  await page.getByRole('button', { name: '지급 달 추가' }).click();
  expectEqual(await page.getByLabel('2번째 지급 달').inputValue(), '2027-01', 'next month');
  await check(page, '3-rule-dialog');
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click();
  await page.getByTestId('pay-rule-row').getByText('2026년 12월 1,500,000원 · 2027년 1월 1,500,000원').waitFor();
  expectEqual(state.posts.at(-1).body, {
    pay_type: 'fixed_total', amount: 3000000, start_date: '2026-11-23', end_date: '2027-01-31', time_slots: ALL, taxable: true, memo: '정시 시즌',
    installments: [{ pay_year_month: '2026-12', amount: 1500000 }, { pay_year_month: '2027-01', amount: 1500000 }], instructor_id: 319,
  }, 'rule payload');

  // 날짜 없이 금액만 + 합계가 다르면 한 번 더 눌러야 저장
  await page.getByRole('button', { name: '규칙 추가' }).click();
  await page.getByLabel('규칙 이름').fill('보너스');
  await page.getByLabel('총액').fill('500000');
  await page.getByText('날짜가 없으면 출근 계산은 그대로 두고 아래 달에 금액만 더해요.').waitFor();
  await page.getByRole('button', { name: '지급 달 추가' }).click();
  await page.getByLabel('1번째 지급 금액').fill('300000');
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click();
  await page.getByRole('button', { name: '그대로 저장' }).click();
  await page.getByTestId('pay-rule-row').getByText('날짜 없음').waitFor();
  const bonus = state.posts.at(-1).body;
  expectEqual([bonus.start_date, bonus.end_date, bonus.confirm_mismatch], [null, null, true], 'bonus payload');
  await check(page, '4-instructor-rules');
}

async function runSeason(page, state) {
  state.rules = [];
  await page.goto('/seasons/21', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '강사 추가' }).click();
  await page.getByLabel('강연요').check();
  await page.getByLabel('오철민').check();
  expectEqual(await page.getByLabel('끝나는 날 (비워도 됨)').inputValue(), '2027-01-31', 'season end');
  await page.getByLabel('총액').fill('3000000');
  await page.getByRole('button', { name: '지급 달 추가' }).click();
  await page.getByLabel('1번째 지급 달').fill('2026-12');
  await page.getByLabel('1번째 지급 금액').fill('1500000');
  await page.getByRole('button', { name: '지급 달 추가' }).click();
  await check(page, '5-season-dialog');
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click();
  await page.getByTestId('season-pay-rules').getByText('오철민').waitFor();
  const { path, body } = state.posts.at(-1);
  expectEqual([path, body.instructor_ids, body.amount], ['/pay-rules/season/21', [319, 2], 3000000], 'season payload');

  // 시즌 기간과 다르면 맞출지 물어본다
  state.rules[0].end_date = '2027-01-29';
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText(/다른 급여 규칙이 1개 있어요/).waitFor();
  await page.getByRole('button', { name: '시즌 기간에 맞추기' }).click();
  await page.getByText('급여 규칙 기간을 시즌에 맞췄습니다.').waitFor();
  expectEqual(state.posts.at(-1), { method: 'POST', path: '/pay-rules/season/21/sync', body: { rule_ids: [1] } }, 'sync payload');
  await check(page, '6-season-rules');
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
      const state = makeState();
      const context = await createAuthedContext(browser, viewport);
      await installRoutes(context, state);
      const page = await context.newPage();
      const diagnostics = createDiagnostics(page);
      if (viewport.width > 1000) {
        await runSalary(page, state);
        await runInstructor(page, state);
        await runSeason(page, state);
      } else {
        for (const [path, name] of [['/salaries/154', 'mobile-salary'], ['/instructors/319', 'mobile-instructor'], ['/seasons/21', 'mobile-season']]) {
          await page.goto(path, { waitUntil: 'networkidle' });
          await check(page, name);
        }
        await page.goto('/instructors/319', { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '규칙 추가' }).click();
        await check(page, 'mobile-rule-dialog');
      }
      const errors = nonServiceWorkerErrors(diagnostics.pageErrors);
      if (errors.length > 0) throw new Error(`unexpected page errors: ${errors.join(' | ')}`);
      await context.close();
    }
    console.log('salary rules smoke passed');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
