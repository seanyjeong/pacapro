const { fail } = require('./maxEngineError');
const { cents, money } = require('./maxEngineSettlement');

function validateContext(input) {
  for (const key of ['academyId', 'studentId', 'userId']) {
    if (!Number.isSafeInteger(input?.[key]) || input[key] <= 0) {
      fail(422, 'INVALID_INPUT', '교육원·학생·처리자 id는 양의 정수여야 합니다.');
    }
  }
  const date = input.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    fail(422, 'INVALID_INPUT', '처리 날짜는 실제 한국 날짜를 YYYY-MM-DD로 입력해 주세요.');
  }
  if (input.reason != null && (typeof input.reason !== 'string' || input.reason.length > 255)) {
    fail(422, 'INVALID_INPUT', '처리 사유는 255자 이하 문자열이어야 합니다.');
  }
  return { ...input, date };
}

function adjustment(invoice, final, status, reason, details) {
  const original = cents(invoice.final_amount), paid = cents(invoice.paid_amount);
  if (original === final && invoice.payment_status === status && !details) return null;
  return { paymentId: invoice.id, action: final === 0 && paid === 0 ? 'cancel' : 'adjust', reason,
    beforeFinal: money(original), beforePaid: money(paid), afterFinal: money(final), afterPaid: money(paid),
    paymentStatus: status, waivedAmount: money(Math.max(0, original - final)), details };
}

function withdrawalAdjustment(invoice, reason) {
  if (['paid', 'cancelled'].includes(invoice.payment_status)) return null;
  const original = cents(invoice.final_amount), paid = cents(invoice.paid_amount);
  if (paid > 0 && paid >= original) return null;
  return adjustment(invoice, paid, paid === 0 ? 'cancelled' : 'paid',
    reason?.trim() || '퇴원 처리에 따른 남은 학원비 정산');
}

function existingPauseDetails(invoice) {
  if (!invoice.proration_details) return null;
  try {
    const details = typeof invoice.proration_details === 'string'
      ? JSON.parse(invoice.proration_details) : invoice.proration_details;
    return details?.type === 'student_pause' ? details : null;
  } catch { fail(409, 'SETTLEMENT_AMOUNT', '기존 휴원 일할계산 내역의 형식을 확인해 주세요.'); }
}

function pauseAdjustment(invoice, date) {
  if (invoice.payment_type !== 'monthly' || invoice.year_month !== date.slice(0, 7) ||
      !['pending', 'partial', 'overdue'].includes(invoice.payment_status)) return null;
  const paid = cents(invoice.paid_amount), original = cents(invoice.final_amount);
  if (paid > 0 && paid >= original) return null;
  const prior = existingPauseDetails(invoice);
  const basis = prior ? cents(prior.original_final_amount) : original;
  const [year, month, day] = date.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Integer cents keep the calendar proration exact before rounding down to 1,000 won.
  const prorated = Number(BigInt(basis) * BigInt(day - 1) / BigInt(daysInMonth) / 100000n * 100000n);
  const final = Math.max(prorated, paid);
  const status = final === 0 && paid === 0 ? 'cancelled' : paid >= final ? 'paid' : invoice.payment_status;
  const details = { type: 'student_pause', rest_start_date: date, year_month: invoice.year_month,
    calculation: 'calendar_days_before_pause', attended_days: day - 1, days_in_month: daysInMonth,
    original_final_amount: money(basis), calendar_prorated_amount: money(prorated),
    paid_amount_floor: money(paid), adjusted_final_amount: money(final) };
  if (prior && original === final && invoice.payment_status === status &&
      Object.keys(prior).length === Object.keys(details).length &&
      Object.keys(details).every(key => prior[key] === details[key]) && invoice.is_prorated === 1) return null;
  return adjustment(invoice, final, status, `휴원 ${date} 시작 전날까지 달력 일할 정산`, details);
}

module.exports = { validateContext, withdrawalAdjustment, pauseAdjustment };
