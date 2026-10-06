const peakPool = require('../config/peak-database');
const transactions = require('../repositories/maxEngineFullCommandRepository');
const repo = require('../repositories/maxEngineTeachingRepository');
const model = require('../models/maxEngineTeaching');
const { decrypt } = require('./maxEngineFullSecurity');
const { table } = require('./maxEngineWorkflowInput');
async function read(actor, p) {
  return transactions.transaction(async conn => {
    const state = await repo.state(conn, actor.academy_id, p.date, p.time_slot);
    const blocked = model.calendarBlocked(state, p.time_slot);
    const instructors = [...state.owners.map(row => ({ ...row, id: -row.id, is_owner: true })),
      ...state.instructors.map(row => ({ ...row, is_owner: false }))].map(row => {
      const reason = blocked ? '해당 날짜·시간대가 휴강·휴일입니다.' : model.instructorReason(state, row.id);
      return { instructor_id: row.id, name: decrypt(row.name), is_owner: row.is_owner,
        scheduled: row.is_owner || state.schedules.some(s => s.instructor_id === row.id),
        work_schedules: state.schedules.filter(s => s.instructor_id === row.id),
        available: !reason, unavailable_reason: reason,
        assigned_classes: state.teachers.filter(t => t.instructor_id === row.id).map(t => t.class_num),
        has_plan: state.plans.some(plan => plan.instructor_id === row.id) };
    });
    const assignments = state.assignments.map(row => ({ assignment_id: row.id, peak_student_id: row.student_id,
      paca_student_id: row.paca_student_id, name: decrypt(row.name), school: row.school, grade: row.grade,
      class_num: row.class_id, attendance_status: row.attendance_status, status: row.status, is_trial: Boolean(row.is_trial),
      assignable: !model.studentReason(row, p.date, p.time_slot),
      unavailable_reason: model.studentReason(row, p.date, p.time_slot) }));
    const allExercises = await repo.exercises(conn, actor.academy_id);
    const plans = state.plans.map(plan => ({ ...plan, tags: model.list(plan.tags), exercises: model.list(plan.exercises),
      completed_exercises: model.list(plan.completed_exercises), extra_exercises: model.list(plan.extra_exercises),
      exercise_times: typeof plan.exercise_times === 'string' ? JSON.parse(plan.exercise_times) : plan.exercise_times || {} }));
    const usedClasses = [...state.teachers.map(row => row.class_num), ...state.assignments.map(row => row.class_id || 0)];
    return { date: p.date, time_slot: p.time_slot, class_time: model.timeRange(state, p.time_slot),
      calendar_blocked: blocked, next_class_num: Math.max(0, ...usedClasses) + 1,
      instructors: table(instructors), class_instructors: table(state.teachers), students: table(assignments),
      plans: table(plans), exercises: table(allExercises.map(row => ({ ...row, tags: model.list(row.tags) }))),
      record_types: table(await repo.recordTypes(conn, actor.academy_id)),
      notices: [
        '이 조회는 근무 일정을 새로 만들거나 출결을 동기화하지 않습니다. 일반 강사는 해당 시간대 PACA 근무 등록이 필요합니다.',
        '운동 id를 사용해 exercises 또는 steps로 실제 운동 항목과 순서를 저장하세요. description만 쓰면 운동 개수는 늘지 않습니다.',
        '운동 목록이 truncated이면 read_resource(exercises)로 나머지 운동을 조회할 수 있습니다.',
      ] };
  }, peakPool);
}
module.exports = { read };
