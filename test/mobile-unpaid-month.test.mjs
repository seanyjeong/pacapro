import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterUnpaidPaymentsByMonth,
  formatYearMonthLabel,
  getCurrentYearMonth,
} from '../src/features/mobile-unpaid/mobile-unpaid-month.mjs';

const payments = [
  { id: 1, year_month: '2026-06' },
  { id: 2, year_month: '2026-07' },
  { id: 3, year_month: '2026-06' },
];

test('선택한 월의 전체 미납만 반환한다', () => {
  assert.deepEqual(
    filterUnpaidPaymentsByMonth(payments, '2026-06').map((payment) => payment.id),
    [1, 3]
  );
});

test('현재 날짜와 선택 월을 한국어 표시값으로 변환한다', () => {
  assert.equal(getCurrentYearMonth(new Date(2026, 6, 19)), '2026-07');
  assert.equal(formatYearMonthLabel('2026-07'), '2026년 7월');
  assert.equal(formatYearMonthLabel(''), '선택한 월');
});
