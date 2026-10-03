const { commands } = require('../constants/maxEnginePeakCommands');
const repo = require('../repositories/maxEnginePeakCommandRepository');
const common = require('../repositories/maxEngineFullCommandRepository');
const { fail } = require('./maxEngineFullSecurity');
const planExercises = require('./maxEnginePeakPlanExercises');
const supports = operation => Object.hasOwn(commands, operation);
async function state(conn, actor, command, lock) {
  const { operation, resource_id: id, changes } = command;
  const spec = commands[operation], create = operation.endsWith('_create');
  const record = create ? null : await repo.row(conn, spec.resource, id, actor.academy_id, lock);
  const source = { ...record, ...changes }, before = { record };
  if (source.student_id) before.student = await repo.linkedStudent(conn, actor, source.student_id, lock);
  if (spec.resource === 'student_records') {
    before.type = await repo.row(conn, 'record_types', source.record_type_id, actor.academy_id, lock);
    if (create) before.matches = await repo.matching(conn, spec.resource, {
      student_id: source.student_id, record_type_id: source.record_type_id, measured_at: source.measured_at }, lock);
  }
  if (spec.resource === 'training_logs' || spec.resource === 'daily_plans') {
    before.instructor = await repo.instructor(conn, actor,
      spec.resource === 'daily_plans' ? source.instructor_id : source.trainer_id, lock);
    if (source.plan_id) before.plan = await repo.row(conn, 'daily_plans', source.plan_id, actor.academy_id, lock);
    if (create && spec.resource === 'daily_plans') before.matches = await repo.matching(conn, spec.resource, {
      academy_id: actor.academy_id, date: source.date, time_slot: source.time_slot, instructor_id: source.instructor_id }, lock);
  }
  if (operation.startsWith('peak_plan_exercise_')) before.exercise = await repo.row(conn, 'exercises', changes.exercise_id, actor.academy_id, lock, true);
  return before;
}
function display(command, before) {
  const { operation, changes } = command;
  const source = { ...before.record, ...changes };
  if (before.matches?.length) fail(409, 'PEAK_DUPLICATE', '같은 학생·종목·날짜의 기록 또는 같은 시간대·강사의 계획이 있습니다. 기존 id를 조회해 수정하세요.');
  if (before.type && !operation.endsWith('_delete')) {
    if (!before.type.is_active) fail(409, 'PEAK_RECORD_TYPE_INACTIVE', '비활성 실기 종목입니다. 활성 종목을 선택해 주세요.');
    const value = Number(source.value), type = before.type;
    if ((type.min_value != null && value < Number(type.min_value)) || (type.max_value != null && value > Number(type.max_value))) {
      fail(422, 'PEAK_RECORD_VALUE_RANGE', `${type.name} 기록은 ${type.min_value ?? '제한 없음'}~${type.max_value ?? '제한 없음'}${type.unit} 범위여야 합니다.`);
    }
  }
  if (before.plan && (before.plan.date !== source.date || before.plan.instructor_id !== source.trainer_id)) {
    fail(422, 'PEAK_PLAN_MISMATCH', '훈련 일지 날짜·강사가 선택한 계획과 다릅니다.');
  }
  const related = { student: before.student ? { peak_id: before.student.student.id,
    paca_id: before.student.paca.id, status: before.student.paca.status } : null,
  record_type: before.type ? { id: before.type.id, name: before.type.name, unit: before.type.unit } : null };
  if (operation.startsWith('peak_plan_exercise_')) return { before: { ...before.record },
    after: { ...before.record, ...planExercises.values(command, before, { toISOString: () => '확인 시각에 기록' }) } };
  return { before: before.record ? { ...before.record, related } : null,
    after: operation.endsWith('_delete') ? { deleted: true, reason: changes.reason, related }
      : { ...source, related } };
}
async function apply(conn, actor, command, before) {
  const { operation, resource_id: id, changes } = command, spec = commands[operation];
  if (operation.startsWith('peak_plan_exercise_')) {
    const values = Object.fromEntries(Object.entries(planExercises.values(command, before)).map(([k, v]) => [k, JSON.stringify(v)]));
    await repo.update(conn, spec.resource, id, actor.academy_id, values); return id;
  }
  if (operation.endsWith('_delete')) { await repo.removeRecord(conn, id, actor.academy_id); return id; }
  if (operation.endsWith('_create')) {
    const values = { academy_id: actor.academy_id, ...changes };
    if (spec.resource === 'student_records') values.notes ??= null;
    if (spec.resource === 'daily_plans') Object.assign(values, { trainer_id: changes.instructor_id,
      tags: '[]', exercises: '[]', completed_exercises: '[]', extra_exercises: '[]', exercise_times: '{}' });
    return common.insert(conn, spec.resource, values);
  }
  await repo.update(conn, spec.resource, id, actor.academy_id, changes);
  return id;
}
module.exports = { supports, state, display, apply };
