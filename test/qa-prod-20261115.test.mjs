import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadTypeScript } from './helpers/load-typescript.mjs';

// 운영 4.1.0 QA(2026-11-15) P01~P07 — 불러온 TS 모듈과 같은 react 인스턴스를 쓴다
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// 2026-11 에 받은 돈 — 손 계산: 완납 200,000 + 완납(받은 금액 빈 옛 자료) 150,000 + 부분 납부 50,000 = 학원비 400,000,
// 기타 수입 24,000 → 총 수입 424,000. 취소된 청구는 납부일이 있어도 수입이 아니다.
const PAID_IN_NOVEMBER = [
  { id: 1, student_id: 1, student_name: '가완납', year_month: '2026-11', final_amount: '200000.00', paid_amount: '200000.00', remaining_amount: '0.00', paid_date: '2026-11-05', payment_method: 'cash', payment_status: 'paid', branch_id: null },
  { id: 2, student_id: 2, student_name: '나옛완납', year_month: '2026-11', final_amount: '150000.00', paid_amount: '0.00', remaining_amount: '0.00', paid_date: '2026-11-06', payment_method: 'account', payment_status: 'paid', branch_id: null },
  { id: 3, student_id: 3, student_name: '다부분', year_month: '2026-11', final_amount: '293000.00', paid_amount: '50000.00', remaining_amount: '243000.00', paid_date: '2026-11-10', payment_method: 'cash', payment_status: 'partial', branch_id: null },
  { id: 4, student_id: 4, student_name: '라취소', year_month: '2026-11', final_amount: '0.00', paid_amount: '30000.00', remaining_amount: '0.00', paid_date: '2026-11-11', payment_method: 'cash', payment_status: 'cancelled', branch_id: null },
];
const OTHER_INCOMES = [{ id: 1, income_date: '2026-11-12', category: 'other', amount: '24000.00' }];

function stubApi(routes) {
  const client = loadTypeScript('src/lib/api/client.ts').default;
  const calls = [];
  client.get = async (url, config = {}) => {
    calls.push({ url, params: config.params });
    const path = url.split('?')[0];
    const query = new URLSearchParams(url.split('?')[1] || '');
    for (const [key, value] of Object.entries(config.params || {})) query.set(key, String(value));
    return routes(path, query);
  };
  return calls;
}

test('P01 수입 화면: 그 달에 받은 완납 + 부분 납부를 받은 금액으로 더한다(손 계산 424,000)', async () => {
  const calls = stubApi((path) => (path === '/incomes' ? { incomes: OTHER_INCOMES } : { payments: PAID_IN_NOVEMBER }));
  const { getIncomePageData } = loadTypeScript('src/features/incomes/incomes-api.ts');
  const { calculateIncomeSummary } = loadTypeScript('src/features/incomes/incomes-utils.ts');

  const data = await getIncomePageData('2026-11');
  const summary = calculateIncomeSummary(data.tuitionPayments, data.otherIncomes);

  assert.deepEqual(calls.find((call) => call.url === '/payments').params, { paid_year: '2026', paid_month: '11' });
  assert.deepEqual(data.tuitionPayments.map((payment) => payment.id), [1, 2, 3]);
  assert.equal(summary.totalTuition, 400000);
  assert.equal(summary.totalOther, 24000);
  assert.equal(summary.totalIncome, 424000);
  assert.equal(summary.tuitionCount, 3);
});

test('P01 수입 표: 줄 금액은 받은 금액이고 부분 납부 줄에는 부분납부 표시가 붙는다', () => {
  const { TuitionPaymentsTable } = loadTypeScript('src/features/incomes/tuition-payments-table.tsx');
  const html = renderToStaticMarkup(React.createElement(TuitionPaymentsTable, { payments: PAID_IN_NOVEMBER.slice(0, 3) }));
  assert.match(html, /\+50,000원/);
  assert.doesNotMatch(html, /\+293,000원/);
  assert.match(html, /\+150,000원/); // 받은 금액이 빈 옛 완납은 청구 금액
  assert.equal(html.match(/부분납부/g)?.length, 2); // 휴대폰 목록 + 넓은 화면 표에 한 번씩
});

test('P01 리포트: 총 수입·학원비 수납도 완납 + 부분 납부의 받은 금액(손 계산 424,000)', async () => {
  const billedNovember = [
    { ...PAID_IN_NOVEMBER[0] },
    { ...PAID_IN_NOVEMBER[2] },
    { id: 5, student_id: 5, year_month: '2026-11', final_amount: '100000.00', paid_amount: '0.00', remaining_amount: '100000.00', payment_status: 'pending', branch_id: null },
  ];
  stubApi((path, query) => {
    if (path === '/students') return { students: [1, 2, 3, 5].map((id) => ({ id, status: 'active', monthly_tuition: 0, branch_id: null })) };
    if (path === '/payments') return { payments: query.has('paid_year') ? PAID_IN_NOVEMBER : billedNovember };
    if (path === '/expenses') return { expenses: [{ id: 1, amount: '48000.00' }] };
    if (path === '/incomes') return { incomes: OTHER_INCOMES };
    return { instructors: [] };
  });
  const { fetchReportSourceData } = loadTypeScript('src/features/reports/reports-api.ts');
  const { calculateReportStats, calculateComputedStats } = loadTypeScript('src/features/reports/reports-utils.ts');

  const data = await fetchReportSourceData('2026-11', { payments: true, expenses: true, instructors: true, incomes: true });
  const stats = calculateReportStats(data);
  const computed = calculateComputedStats(stats);

  assert.equal(stats.payments.paidAmount, 400000);
  assert.equal(computed.totalIncome, 424000);
  assert.equal(computed.netProfit, 376000);
  // 이달 청구 593,000 중 받은 돈 250,000(완납 200,000 + 부분 50,000) → 수납률 42%, 미수금 343,000
  assert.equal(stats.payments.totalAmount, 593000);
  assert.equal(stats.payments.paidAmountFromBilled, 250000);
  assert.equal(computed.collectionRate, 42);
  assert.equal(computed.unpaidAmount, 343000);
});

// P02 — 남은 금액이 있는 부분 납부는 미납으로 세고, 납부율은 금액 기준
const BILLS = [
  { id: 11, student_id: 11, year_month: '2026-11', payment_type: 'monthly', final_amount: '293000.00', paid_amount: '50000.00', remaining_amount: '243000.00', payment_status: 'partial', due_date: '2026-11-05' },
  { id: 12, student_id: 12, year_month: '2026-11', payment_type: 'monthly', final_amount: '100000.00', paid_amount: '0.00', remaining_amount: '100000.00', payment_status: 'pending', due_date: '2026-11-05' },
  { id: 13, student_id: 13, year_month: '2026-11', payment_type: 'monthly', final_amount: '200000.00', paid_amount: '200000.00', remaining_amount: '0.00', payment_status: 'paid', due_date: '2026-11-05' },
  { id: 14, student_id: 14, year_month: '2099-01', payment_type: 'season', final_amount: '50000.00', paid_amount: '10000.00', remaining_amount: '40000.00', payment_status: 'partial', due_date: '2099-01-01' },
];

test('P02 학원비 요약: 미납 = 미납 + 잔액 남은 부분 납부(시작 전 시즌비 제외), 납부율은 받은 금액 ÷ 총 청구', () => {
  const { calculatePaymentSummary } = loadTypeScript('src/features/payments/payments-utils.ts');
  const onlyPartial = calculatePaymentSummary([BILLS[0]], '2026-11');
  assert.equal(onlyPartial.unpaidCount, 1);
  assert.equal(onlyPartial.unpaidPartialCount, 1);
  assert.equal(onlyPartial.paidRate, 17); // 50,000 / 293,000 = 17.06%

  const summary = calculatePaymentSummary(BILLS.slice(0, 3), '2026-11');
  assert.equal(summary.paidCount, 1);
  assert.equal(summary.unpaidCount, 2);
  assert.equal(summary.unpaidPartialCount, 1);
  assert.equal(summary.paidRate, 42); // 250,000 / 593,000 = 42.2%

  const season = calculatePaymentSummary([{ ...BILLS[3], year_month: '2026-11' }], '2026-11');
  assert.equal(season.unpaidCount, 0); // 시작 전 시즌비는 지금처럼 미납에서 뺀다
});

test('P02 요약 칸: 미납 칸 아래에 부분납부 포함 건수, 태블릿 결제 확인도 같은 수', () => {
  const { calculatePaymentSummary } = loadTypeScript('src/features/payments/payments-utils.ts');
  const { PaymentSummaryStrip } = loadTypeScript('src/features/payments/payment-summary-strip.tsx');
  const { TabletPaymentsSummary } = loadTypeScript('src/features/tablet-payments/tablet-payments-summary.tsx');
  const summary = calculatePaymentSummary([BILLS[0]], '2026-11');

  const strip = renderToStaticMarkup(React.createElement(PaymentSummaryStrip, {
    summary, viewOnly: false, isOwner: true, filters: {}, onFilterChange() {},
  }));
  assert.match(strip, /data-testid="payments-metric-unpaid".*?1건.*?부분납부 1건 포함/s);
  assert.match(strip, /data-testid="payments-metric-rate".*?17%.*?50,000 \/ 293,000원/s);

  const tablet = renderToStaticMarkup(React.createElement(TabletPaymentsSummary, { summary }));
  assert.match(tablet, /미납.*?1건.*?부분납부 1건 포함/s);
});

test('P03 출석 체크: 이 수업에 보충으로 추가한 학생은 출석을 찍을 수 있고, 다른 날짜에서 온 보충만 잠근다', () => {
  const { AttendanceStudentRow } = loadTypeScript('src/features/attendance-checker/attendance-student-row.tsx');
  const render = (attendance) => renderToStaticMarkup(React.createElement(AttendanceStudentRow, {
    attendance: { student_id: 11601, student_name: '보충', student_number: '1', attendance_status: null, ...attendance },
    readOnly: false, onStatusChange() {}, onMakeupDateChange() {}, onNotesChange() {},
  }));
  const added = render({ is_makeup: true });
  assert.match(added, /보충<\/div>/);
  assert.doesNotMatch(added, /disabled=""/);
  const fromOtherDate = render({ is_makeup: true, original_date: '2026-11-13', attendance_status: 'present' });
  assert.match(fromOtherDate, /disabled=""/);
});

test('P05 학생 상세 납부 내역: 서버 상태값(pending)을 한글로 보인다', () => {
  const { StudentPaymentHistory } = loadTypeScript('src/components/students/student-payment-history.tsx');
  const payment = (id, status) => ({
    id, student_id: 11606, year_month: '2026-11', base_amount: '370000.00', discount_amount: '107000.00', final_amount: '263000.00',
    paid_amount: status === 'paid' ? '263000.00' : '0.00', payment_type: 'monthly', payment_status: status, due_date: '2026-11-05', created_at: '2026-11-15',
  });
  const html = renderToStaticMarkup(React.createElement(StudentPaymentHistory, {
    payments: [payment(1, 'pending'), payment(2, 'partial'), payment(3, 'paid')], recalculating: false, onRecalculateClick() {},
  }));
  assert.doesNotMatch(html, />pending</);
  assert.match(html, />미납</);
  assert.match(html, />부분납부</);
  assert.match(html, />완납</);
});

test('P06 휴일·출석 마감 칸이 0(숫자)일 때 화면에 0 을 그리지 않는다', () => {
  const events = readFileSync('src/features/mobile-academy-events/mobile-academy-events-page.tsx', 'utf8');
  assert.match(events, /\{!!event\.is_holiday && <Badge/);
  const attendance = readFileSync('src/app/schedules/[id]/attendance/page.tsx', 'utf8');
  assert.match(attendance, /\{!!schedule\.attendance_taken && \(/);
});

test('P07 급여 명세 PDF: 화면 테마와 상관없이 흰 바탕에 짙은 글자', () => {
  const source = readFileSync('src/lib/utils/pdf-generator.ts', 'utf8');
  assert.match(source, /<div style="width: 700px; padding: 24px; font-family: 'Malgun Gothic', sans-serif; background: white; color: #111827;">/);
});
