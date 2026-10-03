const repo = require('../repositories/maxEngineFullCommandRepository');
const lifecycle = require('../repositories/maxEngineLifecycleRepository');
const { decrypt, fail } = require('./maxEngineFullSecurity');
const { prepareStudentTrialUpdate } = require('./trialStatusService');
const supports = operation => ['student_withdraw', 'student_reactivate'].includes(operation);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function state(conn, actor, command, lock) {
  const student = await repo.row(conn, 'students', command.resource_id, actor.academy_id, lock);
  const day = today();
  const reservations = command.operation === 'student_withdraw'
    ? await lifecycle.reservations(conn, actor.academy_id, student.id, day, lock) : [];
  return { student, today: day, reservations };
}
function reactivationValues(student) {
  const trial = prepareStudentTrialUpdate({ currentStudent: student, status: 'active' });
  return { status: 'active', rest_start_date: null, rest_end_date: null, rest_reason: null,
    ...(trial.isTrial === undefined ? {} : { is_trial: trial.isTrial ? 1 : 0 }),
    ...(trial.trialRemaining === undefined ? {} : { trial_remaining: trial.trialRemaining }) };
}
function display(command, before) {
  const { student, reservations } = before;
  if (command.operation === 'student_withdraw') {
    if (student.status === 'withdrawn') fail(409, 'STUDENT_STATUS_CONFLICT', '이미 퇴원한 학생입니다.');
    if (command.changes.withdrawal_date > before.today) fail(422, 'STUDENT_DATE_RANGE', '퇴원 예약은 지원하지 않습니다. 퇴원일은 오늘(KST)까지 입력해 주세요.');
  } else if (!['withdrawn', 'graduated'].includes(student.status)) {
    fail(409, 'STUDENT_STATUS_CONFLICT', '퇴원·졸업 학생만 이 작업으로 복귀할 수 있습니다. 휴원생은 휴원 정산 복귀를 사용하세요.');
  }
  const old = { id: student.id, name: decrypt(student.name), status: student.status,
    withdrawal_date: student.withdrawal_date, withdrawal_reason: student.withdrawal_reason,
    monthly_tuition: student.monthly_tuition, class_days: student.class_days,
    is_trial: student.is_trial, trial_remaining: student.trial_remaining,
    rest_start_date: student.rest_start_date, rest_end_date: student.rest_end_date, rest_reason: student.rest_reason,
    current_season_id: student.current_season_id, is_season_registered: student.is_season_registered };
  const after = { ...old, status: command.operation === 'student_withdraw' ? 'withdrawn' : 'active' };
  if (command.operation === 'student_withdraw') Object.assign(after, {
    withdrawal_date: command.changes.withdrawal_date, withdrawal_reason: command.changes.reason || null });
  if (command.operation === 'student_reactivate') Object.assign(after, reactivationValues(student));
  after.related = { attendance_to_remove: reservations.map(r => ({ id: r.id, class_date: r.class_date,
    attendance_status: r.attendance_status })), payment_changes: [],
    future_monthly_billing: after.status === 'active', attendance_restored: 0 };
  return { before: old, after };
}
async function apply(conn, actor, command, before) {
  if (command.operation === 'student_withdraw') return lifecycle.withdraw(conn, actor, command, before);
  await repo.update(conn, 'students', command.resource_id, reactivationValues(before.student));
  return command.resource_id;
}
module.exports = { supports, state, display, apply };
