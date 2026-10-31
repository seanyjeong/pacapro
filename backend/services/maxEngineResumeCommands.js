const repo = require('../repositories/maxEngineResumeRepository');
const commandRepo = require('../repositories/maxEngineFullCommandRepository');
const creditService = require('./restCreditRecalculationService');
const paymentService = require('./resumePaymentService');
const { autoAssignStudentToSchedules, resumeScheduleTargets } = require('./studentScheduleAssignment');
const { getKoreaDateText } = require('../utils/proratedPaymentDueDate');
const { fail, decrypt } = require('./maxEngineFullSecurity');

function checked(work) {
  try { return work(); }
  catch (error) {
    if (error instanceof creditService.RestCreditRecalculationConflictError) fail(409, 'REST_CREDIT_RECALCULATION_CONFLICT', error.message);
    if (error instanceof creditService.RestCreditRecalculationValidationError) fail(422, 'INVALID_INPUT', error.message);
    throw error;
  }
}
async function state(conn, student, command, lock) {
  // Bind an omitted date to KST today; midnight invalidates the old receipt.
  const resumeDate = command.changes.resume_date || getKoreaDateText();
  checked(() => creditService.planRestCreditsOnResume({ student, resumeDate, credits: [] }));
  return { student, resumeDate, ...await repo.state(conn, student, resumeDate, lock) };
}
function plan(before) {
  return checked(() => {
    const { student, resumeDate, credits, payments, schedules, attendance } = before;
    const creditRecalculation = creditService.planRestCreditsOnResume({ student, resumeDate, credits });
    const classDays = paymentService.normalizeResumeClassDays(student.class_days);
    const billing = paymentService.planResumePayment({ student, resumeDate, classDays, creditRecalculation, payments, canCreateMonthlyPayment: before.canCreateMonthlyPayment });
    const scheduleChanges = resumeScheduleTargets(classDays, resumeDate, student.time_slot || 'evening', before.seasonGaps).map(target => {
      const schedule = schedules.find(s => s.class_date === target.date && s.time_slot === target.time_slot);
      return { ...target, schedule_id: schedule?.id ?? null,
        create_schedule: !schedule, assign_attendance: !schedule || !attendance.some(a => a.class_schedule_id === schedule.id) };
    });
    return { creditRecalculation, ...billing, scheduleChanges };
  });
}
function display(_command, before) {
  const { student, resumeDate, credits, payments } = before;
  const result = plan(before);
  const old = { id: student.id, name: decrypt(student.name), status: student.status,
    rest_start_date: student.rest_start_date, rest_end_date: student.rest_end_date, rest_reason: student.rest_reason };
  const adjusted = result.paymentAdjusted;
  const afterPayments = result.paymentCreated ? [result.paymentCreated] : payments.map(p => adjusted?.id === p.id
    ? { ...p, final_amount: adjusted.finalAmount, is_prorated: 1,
      payment_status: Number(p.paid_amount) >= adjusted.finalAmount ? 'paid' : Number(p.paid_amount) > 0 ? 'partial'
        : p.due_date < resumeDate ? 'overdue' : 'pending' } : p);
  const credit = result.creditRecalculation;
  return { before: { ...old, related: { credits, payments } }, after: {
    ...old, status: 'active', rest_start_date: null, rest_end_date: null, rest_reason: null,
    resume_date: resumeDate, related: { ...result, payments: afterPayments,
      credits: credits.map(c => credit?.creditId === c.id ? { ...c, credit_amount: credit.creditAmount,
        remaining_amount: credit.remainingAmount, rest_days: credit.restDays,
        rest_end_date: credit.restEndDate, status: credit.status } : c),
      credit_application: '휴원 크레딧 잔액을 재계산·보존하며 복귀 청구에 새로 자동 차감하지 않습니다. 기존 사용액·이월 적용액은 유지합니다.',
      activation: '확인 즉시 재원 전환됩니다. 미래 복귀일도 예약이 아니며, 선택한 날짜부터 해당 월 말일까지 출결을 배정합니다.' },
  } };
}
async function apply(conn, actor, command, before) {
  const { student, resumeDate } = before;
  // These are the exact services called by POST /students/:id/resume; the caller owns the transaction.
  const creditRecalculation = await creditService.recalculateRestCreditsOnResume({ connection: conn, student, resumeDate });
  const classDays = paymentService.normalizeResumeClassDays(student.class_days);
  await paymentService.processResumePayment({ connection: conn, student, resumeDate, classDays,
    creditRecalculation, recordedBy: actor.user_id });
  if (classDays.length) await autoAssignStudentToSchedules(conn, student.id, student.academy_id,
    classDays, resumeDate, student.time_slot || 'evening', { includeFutureMonth: true });
  await commandRepo.update(conn, 'students', student.id, {
    status: 'active', rest_start_date: null, rest_end_date: null, rest_reason: null,
  });
  return command.resource_id;
}
module.exports = { state, display, apply, plan };
