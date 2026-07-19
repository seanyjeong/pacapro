/**
 * @param {Date} [date]
 */
export function getCurrentYearMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @template {{ year_month: string }} T
 * @param {T[]} payments
 * @param {string} selectedMonth
 * @returns {T[]}
 */
export function filterUnpaidPaymentsByMonth(payments, selectedMonth) {
  return payments.filter((payment) => payment.year_month === selectedMonth);
}

/**
 * @param {string} yearMonth
 */
export function formatYearMonthLabel(yearMonth) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);
  if (!match) return '선택한 월';
  return `${match[1]}년 ${Number(match[2])}월`;
}
