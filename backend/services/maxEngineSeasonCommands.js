const { commands } = require('../constants/maxEngineSeasonCommands');
const repo = require('../repositories/maxEngineSeasonRepository');
const commandRepo = require('../repositories/maxEngineFullCommandRepository');
const { validateSeasonCreate, insertSeason } = require('./seasonCreateService');
const seasonEnrollment = require('./seasonEnrollmentService');
const { getKoreaDateText } = require('../utils/proratedPaymentDueDate');
const { fail, decrypt } = require('./maxEngineFullSecurity');
const supports = operation => Object.hasOwn(commands, operation);
const conflict = message => fail(409, 'SEASON_CONFLICT', message);
const invalid = message => fail(422, 'SEASON_INVALID', message);

async function state(conn, actor, command, lock) {
  const { operation, resource_id: id, changes } = command;
  if (operation === 'season_create') return {};
  // 날짜를 생략하면 한국 날짜 오늘로 묶는다 — 자정이 지나면 예전 미리보기는 확인되지 않는다.
  if (operation === 'season_enroll') return { ...await repo.enrollState(conn, actor, id, changes.season_id, lock),
    registrationDate: changes.registration_date || getKoreaDateText() };
  const before = await repo.enrollmentState(conn, actor, id, lock);
  return operation === 'season_enrollment_cancel' ? { ...before, cancelDate: changes.cancellation_date || getKoreaDateText() } : before;
}
function planEnroll({ changes }, before) {
  const { student, season, enrollments, seasonPayments, registrationDate } = before;
  if (season.status === 'ended') conflict('종료된 시즌에는 등록할 수 없습니다.');
  if (!['active', 'paused'].includes(student.status)) conflict('재원·휴원 학생만 시즌에 등록할 수 있습니다. 예비·체험생은 먼저 정식 등록해 주세요.');
  if (student.student_type === 'adult') conflict('성인·공무원 학생은 시즌 대신 월회비로 관리합니다.');
  const existing = enrollments.find(e => e.season_id === season.id && e.payment_status !== 'cancelled') || null;
  let previousSeasonId = null;
  if (changes.is_continuous) {
    if (!season.allows_continuous) invalid('이 시즌은 연속 등록을 받지 않습니다.');
    const previous = enrollments.filter(e => e.season_id !== season.id && e.season_start_date < season.season_start_date)
      .sort((a, b) => a.season_start_date.localeCompare(b.season_start_date)).at(-1);
    if (!previous) invalid('이전 시즌 등록이 없어 연속 등록 할인을 적용할 수 없습니다.');
    previousSeasonId = previous.season_id;
  }
  // 화면 학생 등록과 같이 시즌 기본 시즌비에서 시작한다
  const plan = seasonEnrollment.planSeasonEnrollment({ season, student, seasonFee: season.default_season_fee, registrationDate,
    isContinuous: changes.is_continuous, previousSeasonId, manualDiscount: changes.discount_amount });
  if (seasonPayments.some(p => p.year_month === plan.yearMonth)) {
    conflict(existing ? '이미 이 시즌에 등록되어 있습니다.' : `${plan.yearMonth} 시즌비 청구가 이미 있습니다. 학원관리에서 먼저 확인해 주세요.`);
  }
  return { existing, previousSeasonId, plan, timeSlots: seasonEnrollment.parseSeasonTimeSlots(changes.time_slots) };
}
function planCancel({ changes }, { enrollment, cancelDate }) {
  if (enrollment.payment_status === 'cancelled') conflict('이미 취소된 시즌 등록입니다.');
  const { paidAmount, refund } = seasonEnrollment.planSeasonCancel({ enrollment, operatingDays: enrollment.operating_days,
    cancelDate, includeVat: changes.include_vat || false });
  const refundAmount = changes.refund_amount === undefined ? null : Number(changes.refund_amount);
  if (refundAmount !== null && refundAmount > paidAmount) invalid(`환불액은 낸 금액(${paidAmount}원)을 넘을 수 없습니다.`);
  return { paidAmount, refund, refundAmount, decisionRequired: paidAmount > 0 && refundAmount === null };
}
function enrollmentView(e) {
  return { enrollment_id: e.id, student_id: e.student_id, name: decrypt(e.student_name), season_id: e.season_id, season_name: e.season_name,
    registration_date: e.registration_date, season_fee: e.season_fee, discount_type: e.discount_type, discount_amount: e.discount_amount,
    time_slots: e.time_slots, final_fee: e.final_fee, paid_amount: e.paid_amount, payment_status: e.payment_status };
}
function display(command, before) {
  const { operation, changes } = command;
  const notice = commands[operation].notice;
  if (operation === 'season_create') {
    const error = validateSeasonCreate(changes);
    if (error) invalid(error);
    return { before: null, after: { ...changes, status: 'upcoming',
      season_monthly_policy: changes.season_monthly_policy || 'season_replaces_monthly' }, notice };
  }
  if (operation === 'season_enroll') {
    const { student, season, monthlyToDelete, regularToRemove, registrationDate } = before;
    const { existing, previousSeasonId, plan, timeSlots } = planEnroll(command, before);
    const identity = { student_id: student.id, name: decrypt(student.name), status: student.status };
    const seasonView = { season_id: season.id, season_name: season.season_name, season_status: season.status,
      season_start_date: season.season_start_date, season_end_date: season.season_end_date, default_season_fee: season.default_season_fee };
    const schedule = season.status !== 'active' ? '시즌 시작 전이라 출결 배정은 파카 시즌 화면에서 시즌을 시작(활성화)할 때 합니다.'
      : student.status === 'paused' ? '휴원생이라 시즌 출결 배정은 복귀 때 합니다.'
        : `시즌 기간의 미체크 정규 출결 ${regularToRemove.length}건을 지우고 시즌 수업에 배정합니다.`;
    return { before: { ...identity, season: seasonView, enrollment: existing ? { id: existing.id } : null,
      related: { monthly_payments: monthlyToDelete } },
    after: { ...identity, season: seasonView, enrollment: { id: existing?.id ?? null, restores_missing_season_bill: Boolean(existing),
      season_fee: plan.finalSeasonFee, registration_date: registrationDate, discount_type: plan.discountType, discount_amount: plan.discountAmount,
      discount_reason: changes.discount_reason || null, time_slots: timeSlots, is_continuous: Boolean(changes.is_continuous),
      previous_season_id: previousSeasonId, prorated_month: plan.proRatedMonth, prorated_amount: plan.proRated?.proRatedFee || 0 },
    related: { season_payment: { ...plan.payment, payment_type: 'season', payment_status: 'pending' }, mid_season: plan.midSeasonProRated,
      deleted_monthly_payments: monthlyToDelete, schedule } }, notice };
  }
  const { enrollment, seasonPayments } = before;
  if (operation === 'season_enrollment_update') {
    if (enrollment.payment_status === 'cancelled') conflict('취소된 시즌 등록입니다.');
    const view = enrollmentView(enrollment);
    return { before: { ...view, related: { season_payments: seasonPayments } },
      after: { ...view, ...changes, related: { season_payments: seasonPayments, season_bill_changed: false } }, notice };
  }
  const result = planCancel(command, before);
  const recordsRefund = result.refundAmount > 0 && result.paidAmount > 0;
  return { before: { ...enrollmentView(enrollment), related: { season_payments: seasonPayments } },
    after: { cancelled: true, cancellation_date: before.cancelDate, related: { refund_calculation: result.refund, paid_amount: result.paidAmount,
      refund_amount: result.refundAmount, refund_decision_required: result.decisionRequired,
      expense: recordsRefund ? { category: 'refund', amount: result.refundAmount, expense_date: before.cancelDate } : null,
      deleted_season_payments: seasonPayments.filter(p => p.payment_status !== 'paid'),
      kept_season_payments: seasonPayments.filter(p => p.payment_status === 'paid'),
      student: { is_season_registered: false, current_season_id: null } } }, notice };
}
async function apply(conn, actor, command, before) {
  const { operation, resource_id: id, changes } = command;
  if (operation === 'season_create') return insertSeason(conn, actor.academy_id, changes);
  if (operation === 'season_enroll') {
    const { student, season, registrationDate } = before;
    const { existing, previousSeasonId, plan, timeSlots } = planEnroll(command, before);
    const result = await seasonEnrollment.applySeasonEnrollment(conn, { season, seasonId: season.id, student, studentId: student.id,
      academyId: actor.academy_id, userId: actor.user_id, existingEnrollmentId: existing?.id, plan,
      input: { registrationDate, isContinuous: Boolean(changes.is_continuous), previousSeasonId, discountReason: changes.discount_reason, timeSlots } });
    return result.enrollmentId;
  }
  if (operation === 'season_enrollment_update') {
    await commandRepo.update(conn, 'student_seasons', id, changes.time_slots
      ? { ...changes, time_slots: JSON.stringify(changes.time_slots) } : changes);
    return id;
  }
  const { enrollment, cancelDate } = before;
  const result = planCancel(command, before);
  if (result.decisionRequired) conflict('낸 금액이 있습니다. 계산 환불액을 원장에게 보여 주고 원장이 정한 refund_amount(환불 없음은 "0")로 새 미리보기를 만들어 주세요.');
  await seasonEnrollment.applySeasonCancel(conn, { enrollment: { ...enrollment, student_name: decrypt(enrollment.student_name) },
    cancelDate, includeVat: changes.include_vat || false, refundAmount: result.refundAmount || 0, paidAmount: result.paidAmount });
  return enrollment.id;
}
module.exports = { supports, state, display, apply };
