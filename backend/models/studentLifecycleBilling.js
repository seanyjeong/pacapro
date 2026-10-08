const { fail } = require('./maxEngineError');
const { cents, money } = require('./maxEngineSettlement');
const { CREDIT_ROUNDING_UNIT } = require('../constants/restCredit');

function calendarProration(basis, date) {
  const day = Number(date.slice(8, 10));
  const monthEnd = new Date(`${date.slice(0, 7)}-01T00:00:00.000Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const daysMonth = monthEnd.getUTCDate(), unit = BigInt(CREDIT_ROUNDING_UNIT * 100);
  return { daysBefore: day - 1, daysMonth,
    amount: Number(BigInt(basis) * BigInt(day - 1) / BigInt(daysMonth) / unit * unit) };
}

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
  if (input.previousDate != null) {
    const previous = input.previousDate;
    if (typeof previous !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(previous) ||
        !Number.isFinite(Date.parse(previous)) || new Date(previous).toISOString().slice(0, 10) !== previous) {
      fail(422, 'INVALID_INPUT', '기존 휴원 시작일의 실제 날짜를 확인해 주세요.');
    }
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

function withdrawalAdjustment(invoice, reason, date, audit) {
  if (['paid', 'cancelled'].includes(invoice.payment_status)) return null;
  const original = cents(invoice.final_amount), paid = cents(invoice.paid_amount);
  if (paid > 0 && paid >= original) return null;
  if (date) {
    if (invoice.payment_type !== 'monthly' || invoice.year_month < date.slice(0, 7)) return null;
    const prior = existingPauseDetails(invoice);
    if (prior && !ownedPauseState(invoice, prior, audit)) {
      fail(409, 'PAUSE_BILLING_CONFLICT', '기존 휴원 청구가 수동 정산되어 퇴원 일할 금액을 자동 계산할 수 없습니다. 정산 이력을 확인해 주세요.');
    }
    const basis = prior ? cents(prior.original_final_amount) : original;
    if (invoice.year_month === date.slice(0, 7) && invoice.is_prorated === 1 && !prior) {
      fail(409, 'PAUSE_BILLING_CONFLICT', '기존 일할 청구의 원금이 없어 퇴원 일할 금액을 계산할 수 없습니다. 원본 청구 금액을 확인해 주세요.');
    }
    if (invoice.year_month === date.slice(0, 7) && !prior && (invoice.base_amount == null ||
        cents(invoice.base_amount) - cents(invoice.discount_amount) + cents(invoice.additional_amount) !== original)) {
      fail(409, 'PAUSE_BILLING_CONFLICT', '기존 청구액이 원래 학원비와 달라 퇴원 전 원금을 확인할 수 없습니다. 원본 청구 금액과 정산 이력을 확인해 주세요.');
    }
    const calendar = calendarProration(basis, date);
    const prorated = invoice.year_month === date.slice(0, 7) ? calendar.amount : 0;
    const final = Math.max(prorated, paid);
    const status = final === 0 && paid === 0 ? 'cancelled' : paid >= final ? 'paid'
      : invoice.payment_status === 'overdue' ? 'overdue' : paid > 0 ? 'partial' : 'pending';
    return adjustment(invoice, final, status, reason?.trim() || '퇴원일 전날까지 월 학원비 일할 정산', {
      type: 'student_withdrawal', billing_cutoff_date: date, year_month: invoice.year_month,
      original_final_amount: money(basis), calendar_prorated_amount: money(prorated),
      paid_amount_floor: money(paid), adjusted_final_amount: money(final),
      attended_days: invoice.year_month === date.slice(0, 7) ? calendar.daysBefore : 0,
      days_in_month: calendar.daysMonth });
  }
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

function pauseReason(date, month, kind) {
  if (kind === 'restored') return `휴원 시작일 ${date} 변경에 따른 ${month} 원금 복원`;
  if (kind === 'pause_period') return `휴원 ${date} 시작 이후 ${month} 청구 정산`;
  return `휴원 ${date} 시작 전날까지 달력 일할 정산`;
}

function ownedPauseState(invoice, prior, audit) {
  const kind = prior.period_kind || 'prorated';
  const startMonth = typeof prior.rest_start_date === 'string' ? prior.rest_start_date.slice(0, 7) : null;
  const periodMatches = kind === 'prorated' ? invoice.year_month === startMonth
    : kind === 'restored' ? invoice.year_month < startMonth : kind === 'pause_period' && invoice.year_month > startMonth;
  if (prior.original_final_amount == null || prior.adjusted_final_amount == null || prior.paid_amount_floor == null ||
      prior.year_month !== invoice.year_month || typeof prior.rest_start_date !== 'string' ||
      !periodMatches) {
    fail(409, 'PAUSE_BILLING_CONFLICT', '기존 휴원 청구의 원금과 계산 내역이 없어 재계산할 수 없습니다. 원본 청구 금액을 확인해 주세요.');
  }
  if (cents(invoice.final_amount) !== cents(prior.adjusted_final_amount)) return false;
  if (!audit) fail(409, 'PAUSE_BILLING_CONFLICT', '기존 휴원 정산 이력이 없어 자동 재계산할 수 없습니다. 청구 정산 이력을 확인해 주세요.');
  if (audit.reason !== pauseReason(prior.rest_start_date, invoice.year_month, kind) ||
      audit.settlement_date !== prior.rest_start_date ||
      !['cancel', 'adjust'].includes(audit.action) ||
      cents(audit.after_final_amount) !== cents(prior.adjusted_final_amount) ||
      cents(audit.after_paid_amount) !== cents(prior.paid_amount_floor)) return false;
  const paid = cents(invoice.paid_amount), final = cents(invoice.final_amount);
  if (invoice.payment_status === 'cancelled') return final === 0 && paid === 0 && audit.action === 'cancel';
  if (invoice.payment_status === 'paid') return paid > 0 && paid >= final;
  return ['pending', 'partial', 'overdue'].includes(invoice.payment_status);
}

function pauseSessionOrigin(invoice, history) {
  const prior = existingPauseDetails(invoice);
  if (!prior) return null;
  if (prior.session_origin_date) return prior.session_origin_date;
  const basis = cents(prior.original_final_amount);
  const events = history.filter(row => row.payment_id === invoice.id);
  const origins = [];
  let lastFinal;
  for (const event of events) {
    const date = event.settlement_date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const kind = invoice.year_month < date.slice(0, 7) ? 'restored'
      : invoice.year_month > date.slice(0, 7) ? 'pause_period' : 'prorated';
    const amount = kind === 'restored' ? basis : kind === 'pause_period' ? 0 : calendarProration(basis, date).amount;
    const after = Math.max(amount, cents(event.after_paid_amount));
    if (event.before_final_amount == null || event.reason !== pauseReason(date, invoice.year_month, kind) ||
        event.action !== (after === 0 && cents(event.after_paid_amount) === 0 ? 'cancel' : 'adjust') ||
        cents(event.after_final_amount) !== after || cents(event.before_paid_amount) !== cents(event.after_paid_amount) ||
        (lastFinal != null && cents(event.before_final_amount) !== lastFinal)) return null;
    if (cents(event.before_final_amount) === basis && amount < basis) origins.push(date);
    lastFinal = cents(event.after_final_amount);
  }
  // Legacy rows can join a sibling session only when its real audit chain has one origin.
  return origins.length === 1 ? origins[0] : null;
}

function pauseAdjustment(invoice, date, previousDate, audit, sessionOrigin, verifiedOrigin) {
  const targetMonth = date.slice(0, 7), previousMonth = previousDate?.slice(0, 7) || targetMonth;
  const from = previousMonth < targetMonth ? previousMonth : targetMonth;
  const to = previousMonth > targetMonth ? previousMonth : targetMonth;
  if (invoice.payment_type !== 'monthly' || invoice.year_month < from || invoice.year_month > to) return null;
  const kind = invoice.year_month < targetMonth ? 'restored' : invoice.year_month > targetMonth ? 'pause_period' : 'prorated';
  const prior = existingPauseDetails(invoice);
  if (!prior && !['pending', 'partial', 'overdue'].includes(invoice.payment_status)) return null;
  if (prior && !previousDate) {
    if (['paid', 'cancelled'].includes(invoice.payment_status)) return null;
  }
  if (prior && previousDate && prior.rest_start_date !== previousDate &&
      (!sessionOrigin || (prior.session_origin_date || verifiedOrigin || prior.rest_start_date) !== sessionOrigin)) {
    fail(409, 'PAUSE_BILLING_CONFLICT', '선택한 청구는 현재 휴원 기간의 정산 이력과 다릅니다. 해당 청구를 먼저 확인해 주세요.');
  }
  const paid = cents(invoice.paid_amount), original = cents(invoice.final_amount);
  if (!prior && paid > 0 && paid >= original) return null;
  if (prior && prior.original_final_amount == null) {
    fail(409, 'PAUSE_BILLING_CONFLICT', '기존 휴원 청구의 원금이 없어 재계산할 수 없습니다. 원본 청구 금액을 확인해 주세요.');
  }
  if (!prior && previousDate && invoice.is_prorated === 1) {
    fail(409, 'PAUSE_BILLING_CONFLICT', '기존 일할 청구에 휴원 전 원금이 없어 다시 일할 계산할 수 없습니다. 원본 청구 금액을 확인해 주세요.');
  }
  if (!prior && previousDate && (invoice.base_amount == null ||
      cents(invoice.base_amount) - cents(invoice.discount_amount) + cents(invoice.additional_amount) !== original)) {
    fail(409, 'PAUSE_BILLING_CONFLICT', '기존 청구액이 원래 학원비와 달라 휴원 전 원금을 확인할 수 없습니다. 원본 청구 금액과 정산 이력을 확인해 주세요.');
  }
  if (kind === 'restored' && !prior) return null;
  const basis = prior ? cents(prior.original_final_amount) : original;
  const correction = Boolean((prior && date !== prior.rest_start_date) || (previousDate && date !== previousDate));
  if (prior && paid > 0 && paid >= basis) {
    if (correction) fail(409, 'PAUSE_BILLING_CONFLICT', '기존 휴원 청구가 원금까지 납부되어 날짜만 자동 변경할 수 없습니다. 납부·휴원 정산 내역을 함께 확인해 주세요.');
    return null;
  }
  const calendar = calendarProration(basis, kind === 'prorated' ? date : `${invoice.year_month}-01`);
  const prorated = kind === 'restored' ? basis : kind === 'pause_period' ? 0 : calendar.amount;
  const final = Math.max(prorated, paid);
  const status = final === 0 && paid === 0 ? 'cancelled' : paid >= final ? 'paid'
    : invoice.payment_status === 'overdue' ? 'overdue' : paid > 0 ? 'partial' : 'pending';
  const details = { type: 'student_pause', rest_start_date: date, year_month: invoice.year_month,
    calculation: kind === 'prorated' ? 'calendar_days_before_pause' : kind === 'restored' ? 'restore_original_month' : 'full_month_paused',
    attended_days: kind === 'restored' ? calendar.daysMonth : kind === 'pause_period' ? 0 : calendar.daysBefore,
    days_in_month: calendar.daysMonth,
    original_final_amount: money(basis), calendar_prorated_amount: money(prorated),
    paid_amount_floor: money(paid), adjusted_final_amount: money(final),
    ...((kind === 'prorated' && prior && !prior.period_kind) ? {} : { period_kind: kind }),
    ...((prior && !prior.session_origin_date && !correction) ? {} :
      { session_origin_date: prior?.session_origin_date || sessionOrigin || prior?.rest_start_date || date }) };
  if (prior && correction && !ownedPauseState(invoice, prior, audit)) {
    fail(409, 'PAUSE_BILLING_CONFLICT', '기존 휴원 청구가 수동 취소·납부·정산되어 날짜만 자동 변경할 수 없습니다. 청구 정산 내역을 함께 확인해 주세요.');
  }
  if (prior && original === final && invoice.payment_status === status &&
      Object.keys(prior).length === Object.keys(details).length &&
      Object.keys(details).every(key => prior[key] === details[key]) && invoice.is_prorated === 1) return null;
  if (prior && !correction && !ownedPauseState(invoice, prior, audit)) return null;
  return adjustment(invoice, final, status, pauseReason(date, invoice.year_month, kind), details);
}

module.exports = { validateContext, withdrawalAdjustment, pauseAdjustment, existingPauseDetails, calendarProration, pauseSessionOrigin };
