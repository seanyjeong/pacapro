import test from 'node:test';
import assert from 'node:assert/strict';
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
