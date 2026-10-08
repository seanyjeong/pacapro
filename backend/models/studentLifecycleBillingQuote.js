const crypto = require('crypto');
const { fail } = require('./maxEngineError');
const { cents } = require('./maxEngineSettlement');
const { calendarProration, existingPauseDetails } = require('./studentLifecycleBilling');
const { CREDIT_ROUNDING_UNIT } = require('../constants/restCredit');
const currency = amount => amount / 100;
const paidCents = invoice => cents(invoice.paid_amount);

function creditPlan(context, invoices, existing, allocations = []) {
  const type = context.creditType || 'none';
  if (!['none', 'carryover', 'refund'].includes(type)) fail(422, 'INVALID_INPUT', '크레딧은 none·carryover·refund 중에서 선택해 주세요.');
  const source = context.sourcePaymentId == null ? null : invoices.find(row => row.id === context.sourcePaymentId);
  if (context.sourcePaymentId != null && (!Number.isSafeInteger(context.sourcePaymentId) || !source)) {
    fail(404, 'NOT_FOUND', '휴원 시작 월의 내 교육원 학생 월 학원비에서 납부 내역을 선택해 주세요.');
  }
  if (type === 'none') return null;
  if (existing.length > 1) fail(409, 'PAUSE_BILLING_CONFLICT', '같은 휴원 기간의 크레딧이 여러 건입니다. 크레딧 내역을 먼저 확인해 주세요.');
  if (existing[0]) {
    const row = existing[0];
    return { id: row.id, existing: true, credit_amount: Number(row.credit_amount), remaining_amount: Number(row.remaining_amount),
      credit_type: row.credit_type, rest_days: row.rest_days, rest_start_date: row.rest_start_date,
      rest_end_date: row.rest_end_date, source_payment_id: row.source_payment_id ?? null, status: row.status };
  }
  const start = new Date(`${context.date}T00:00:00.000Z`);
  const monthEnd = new Date(start); monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const endText = context.restEndDate || monthEnd.toISOString().slice(0, 10);
  const end = new Date(`${endText}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endText) || !Number.isFinite(end.getTime()) ||
      end.toISOString().slice(0, 10) !== endText || end < start) fail(422, 'INVALID_INPUT', '휴원 종료일은 시작일 이후의 실제 날짜로 입력해 주세요.');
  const effectiveEnd = end < monthEnd ? end : monthEnd;
  const restDays = effectiveEnd.getUTCDate() - start.getUTCDate() + 1;
  if (context.student?.monthly_tuition == null) fail(409, 'PAUSE_BILLING_CONFLICT', '학생 월 수강료가 없어 휴원 크레딧을 계산할 수 없습니다. 월 수강료를 확인해 주세요.');
  const tuition = cents(context.student.monthly_tuition);
  const unit = BigInt(CREDIT_ROUNDING_UNIT * 100);
  const calculated = effectiveEnd.getTime() === monthEnd.getTime()
    ? Math.max(0, tuition - calendarProration(tuition, context.date).amount)
    : Number(BigInt(tuition) * BigInt(restDays) / BigInt(monthEnd.getUTCDate()) / unit * unit);
  const eligible = source ? [source] : invoices;
  const paid = eligible.filter(row => !context.protectedPaymentIds?.includes(row.id) && row.payment_status !== 'cancelled' &&
    !(existingPauseDetails(row) && !context.previousDate && row.payment_status === 'paid')).reduce((sum, row) => {
    const prior = existingPauseDetails(row);
    const basis = prior ? cents(prior.original_final_amount) : cents(row.final_amount);
    const earned = calendarProration(basis, context.date).amount;
    return sum + Math.max(0, paidCents(row) - earned);
  }, 0);
  const reserved = allocations.filter(row => !source || row.source_payment_id == null || row.source_payment_id === source.id)
    .reduce((sum, row) => sum + cents(row.credit_amount), 0);
  const amount = Math.floor(Math.min(calculated, Math.max(0, paid - reserved)) / 100) * 100;
  if (amount === 0) return null;
  return { credit_amount: currency(amount), remaining_amount: currency(amount), credit_type: type, rest_days: restDays,
    rest_start_date: context.date, rest_end_date: endText, source_payment_id: source?.id ?? null, existing: false };
}

function quoteRows(payments, changes, cutoff, action, context = {}) {
  const changed = new Map(changes.map(change => [change.paymentId, change]));
  return payments.map(row => {
    const change = changed.get(row.id), prior = existingPauseDetails(row);
    const original = prior ? cents(prior.original_final_amount) : cents(row.final_amount);
    const paid = paidCents(row), before = cents(row.final_amount);
    const final = change ? cents(change.afterFinal) : before;
    const monthly = row.payment_type === 'monthly';
    const protectedPrior = context.protectedPaymentIds?.includes(row.id) ||
      (action === 'pause' && prior && !context.previousDate && ['paid','cancelled'].includes(row.payment_status));
    const affected = monthly && row.year_month === cutoff.slice(0, 7);
    const future = action === 'withdraw' && monthly && row.year_month > cutoff.slice(0, 7);
    const periodKind = protectedPrior ? 'protected' : change?.details?.period_kind || (affected ? 'prorated' : 'preserved');
    const calendar = calendarProration(original, affected ? cutoff : `${row.year_month}-01`);
    const prorated = protectedPrior ? before : periodKind === 'restored' ? original : periodKind === 'pause_period' ? 0
      : affected ? calendar.amount : future ? 0 : original;
    return { payment_id: row.id, year_month: row.year_month, payment_type: row.payment_type,
      before_status: row.payment_status, after_status: change?.paymentStatus || row.payment_status,
      original_amount: currency(original), before_final_amount: currency(before), paid_amount: currency(paid),
      period_kind: periodKind,
      days_before: protectedPrior ? null : periodKind === 'restored' ? calendar.daysMonth
        : periodKind === 'pause_period' ? 0 : affected ? calendar.daysBefore : null,
      days_month: protectedPrior ? null : affected || ['restored','pause_period'].includes(periodKind) ? calendar.daysMonth : null,
      prorated_amount: currency(prorated), adjusted_amount: currency(final),
      outstanding_amount: ['paid', 'cancelled'].includes(change?.paymentStatus || row.payment_status)
        ? 0 : currency(Math.max(0, final - paid)),
      waived_amount: currency(Math.max(0, before - final)),
      refundable_amount: !protectedPrior && (affected || future || periodKind === 'pause_period')
        ? currency(Math.max(0, paid - prorated)) : 0, changed: Boolean(change),
      requires_payment_review: row.payment_status === 'paid' && paid === 0 && before > 0 };
  });
}

function fingerprint(value) {
  const stable = item => Array.isArray(item) ? item.map(stable) : item && typeof item === 'object'
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, stable(item[key])])) : item;
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

module.exports = { quoteRows, creditPlan, fingerprint, paidCents };
