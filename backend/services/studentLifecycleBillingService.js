const repository = require('../repositories/studentLifecycleBillingRepository');
const { validateContext, withdrawalAdjustment, pauseAdjustment, existingPauseDetails, calendarProration, pauseSessionOrigin } = require('../models/studentLifecycleBilling');
const { quoteRows, creditPlan, fingerprint } = require('../models/studentLifecycleBillingQuote');
const { cents } = require('../models/maxEngineSettlement');
const { fail } = require('../models/maxEngineError');

async function plan(conn, input, action, lock) {
  if (!['pause', 'withdraw'].includes(action)) fail(422, 'INVALID_INPUT', '처리는 pause·withdraw 중에서 선택해 주세요.');
  const context = validateContext({ ...input, previousDate: action === 'pause' ? input.previousDate : null });
  const options = { lock };
  let cutoff = context.date;
  if (action === 'withdraw' && context.student?.status === 'paused' && context.student.rest_start_date) {
    cutoff = context.student.rest_start_date < cutoff ? context.student.rest_start_date : cutoff;
    validateContext({ ...context, date: cutoff, previousDate: null });
  }
  if (action === 'pause' && context.previousDate && context.previousDate !== context.date &&
      (await repository.pauseCredits(conn, context, options)).length) {
    fail(409, 'PAUSE_BILLING_CONFLICT', '이 휴원에 이월·환불 크레딧이 연결되어 있어 날짜만 바꿀 수 없습니다. 크레딧 사용·환불 내역과 학원비를 함께 정산해 주세요.');
  }
  const payments = await repository[action === 'pause' ? 'pausePayments' : 'withdrawalPayments'](conn, context, options);
  const creditPayments = payments.filter(row => row.payment_type === 'monthly' && row.year_month === context.date.slice(0, 7));
  if (action === 'pause' && context.previousDate && context.previousDate.slice(0, 7) !== context.date.slice(0, 7) &&
      !creditPayments.length && (context.student?.monthly_tuition == null || cents(context.student.monthly_tuition) > 0)) {
    fail(409, 'BILLING_MONTH_MISSING', '새 휴원 시작 월의 청구가 없어 원금과 일할 금액을 계산할 수 없습니다. 해당 월의 실제 청구 내역을 먼저 확인해 주세요.');
  }
  const managed = payments.filter(row => existingPauseDetails(row)).map(row => row.id);
  const protectedIds = action === 'pause' && context.student?.status === 'active' && !context.previousDate ? managed : [];
  const calculationContext = { ...context, protectedPaymentIds: protectedIds };
  const audits = await repository.pauseAudits(conn, context, managed,
    { ...options, history: action === 'pause' && Boolean(context.previousDate) });
  const auditMap = new Map(audits.map(row => [row.payment_id, row]));
  const origins = action === 'pause' && context.previousDate ? [...new Set(payments
    .filter(row => existingPauseDetails(row)?.rest_start_date === context.previousDate)
    .map(row => pauseSessionOrigin(row, audits) || context.previousDate))] : [context.date];
  if (origins.length > 1) fail(409, 'PAUSE_BILLING_CONFLICT', '청구에 서로 다른 휴원 시작 이력이 있어 날짜를 자동 변경할 수 없습니다. 원본 정산 이력을 확인해 주세요.');
  const sessionOrigin = origins[0];
  const changes = payments.map(row => protectedIds.includes(row.id) ? null : action === 'pause'
    ? pauseAdjustment(row, context.date, context.previousDate, auditMap.get(row.id), sessionOrigin, pauseSessionOrigin(row, audits))
    : withdrawalAdjustment(row, context.reason, context.legacyGraduation ? null : cutoff, auditMap.get(row.id))).filter(Boolean);
  const seasons = action === 'withdraw' ? await repository.seasonRows(conn, context, options) : [];
  const needsCredit = action === 'pause' && context.creditType && context.creditType !== 'none';
  const existingCredits = needsCredit ? await repository.creditRows(conn, context, options) : [];
  const allocations = needsCredit && !existingCredits.length
    ? await repository.creditAllocations(conn, context, creditPayments.filter(row => !protectedIds.includes(row.id)).map(row => row.id), options) : [];
  const credit = action === 'pause' ? creditPlan(calculationContext, creditPayments, existingCredits, allocations) : null;
  const rows = quoteRows(payments, changes, cutoff, action, calculationContext);
  const fields = ['original_amount', 'before_final_amount', 'prorated_amount', 'adjusted_amount', 'paid_amount',
    'outstanding_amount', 'waived_amount', 'refundable_amount'];
  const summary = Object.fromEntries(fields.map(key => [key,
    Number(rows.reduce((sum, row) => sum + BigInt(cents(row[key])), 0n)) / 100]));
  const sourceFields = ['id', 'year_month', 'payment_type', 'payment_status', 'final_amount', 'paid_amount',
    'base_amount', 'discount_amount', 'additional_amount', 'is_prorated', 'proration_details'];
  const source = payments.map(row => Object.fromEntries(sourceFields.map(key => [key,
    key === 'proration_details' && typeof row[key] === 'string' ? JSON.parse(row[key]) : row[key] ?? null])));
  const previewHash = fingerprint({ action, date: context.date, cutoff, previousDate: context.previousDate || null,
    academyId: context.academyId, studentId: context.studentId, userId: context.userId,
    creditType: context.creditType || 'none', restEndDate: context.restEndDate || null,
    sourcePaymentId: context.sourcePaymentId ?? null, creditTuition: needsCredit ? context.student?.monthly_tuition : null,
    source, audits, seasons, existingCredits, allocations, expectedResult: { rows, summary, credit } });
  const calendar = calendarProration(0, cutoff);
  return { context, changes, quote: { action, date: context.date, billing_cutoff_date: cutoff,
    year_month: cutoff.slice(0, 7), student_id: context.studentId, days_before: calendar.daysBefore,
    days_month: calendar.daysMonth, rows, summary, credit, preview_hash: previewHash,
    requires_confirmation: true, readonly: true, external_refund_executed: false,
    requires_payment_review: rows.some(row => row.requires_payment_review) } };
}

function confirmPreview(context, quote) {
  if (context.expectedPreviewHash != null && context.expectedPreviewHash !== quote.preview_hash) {
    fail(409, 'SOURCE_CHANGED', '미리보기 이후 학원비·납부·크레딧 또는 처리 조건이 바뀌었습니다. 새 금액을 확인한 뒤 저장해 주세요.');
  }
}

async function preview(conn, input) {
  return (await plan(conn, input, input.action, false)).quote;
}

async function withdraw(conn, input) {
  const { context, changes, quote } = await plan(conn, input, 'withdraw', true);
  confirmPreview(context, quote);
  for (const change of changes) await repository.persist(conn, context, change);
  const cancelledSeasons = await repository.endSeasons(conn, context);
  const cancelledPayments = changes.filter(change => change.action === 'cancel').length;
  const adjustedPayments = changes.length - cancelledPayments;
  return { cancelledPayments, adjustedPayments, waivedAmount: quote.summary.waived_amount,
    originalAmount: quote.summary.before_final_amount, adjustedAmount: quote.summary.adjusted_amount,
    paidAmount: quote.summary.paid_amount, outstandingAmount: quote.summary.outstanding_amount,
    summary: quote.summary, rows: quote.rows, billing_cutoff_date: quote.billing_cutoff_date,
    paymentIds: changes.map(change => change.paymentId), cancelledSeasons,
    message: `월 학원비 ${adjustedPayments}건 일할 정산·미래 청구 ${cancelledPayments}건 취소 (납부 이력 보존)`,
    seasonMessage: `시즌 등록 ${cancelledSeasons.length}건 종료` };
}

async function pause(conn, input) {
  const { context, changes, quote } = await plan(conn, input, 'pause', true);
  confirmPreview(context, quote);
  for (const change of changes) await repository.persist(conn, context, change);
  const action = !changes.length ? 'unchanged' : changes.every(change => change.action === 'cancel') ? 'cancelled' : 'adjusted';
  return { action, originalAmount: quote.summary.before_final_amount, adjustedAmount: quote.summary.adjusted_amount,
    paidAmount: quote.summary.paid_amount, outstandingAmount: quote.summary.outstanding_amount,
    summary: quote.summary, rows: quote.rows, credit: quote.credit,
    paymentIds: changes.map(change => change.paymentId),
    message: changes.length ? `${context.date.slice(0, 7)} 휴원 학원비 ${changes.length}건 정산 (납부 이력 보존)`
      : `${context.date.slice(0, 7)} 변경할 미납 월 학원비가 없습니다.` };
}

module.exports = { withdraw, pause, preview, validateContext };
