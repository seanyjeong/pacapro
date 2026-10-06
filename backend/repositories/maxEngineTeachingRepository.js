const { pacaSchema } = require('../config/maxEnginePeak');
const { fail } = require('../models/maxEngineError');
const common = require('./maxEngineFullCommandRepository');
const rows = async (conn, sql, params, lock) => (await conn.execute(sql + (lock ? ' FOR UPDATE' : ''), params))[0];

async function state(conn, academy, date, slot, lock = false) {
  const paca = pacaSchema(), args = [academy, date, slot];
  // Explicit projections keep financial/private instructor and student fields out of previews.
  const instructors = await rows(conn, `SELECT id,name FROM ${paca}.instructors
    WHERE academy_id=? AND status='active' AND deleted_at IS NULL ORDER BY id`, [academy], lock);
  const owners = await rows(conn, `SELECT id,name FROM ${paca}.users
    WHERE academy_id=? AND role='owner' AND is_active=1 AND deleted_at IS NULL ORDER BY id`, [academy], lock);
  const schedules = await rows(conn, `SELECT id,instructor_id,scheduled_start_time,scheduled_end_time
    FROM ${paca}.instructor_schedules WHERE academy_id=? AND work_date=? AND time_slot=? ORDER BY id`, args, lock);
  const teachers = await rows(conn, `SELECT id,class_num,instructor_id,is_main,order_num FROM class_instructors
    WHERE academy_id=? AND date=? AND time_slot=? ORDER BY class_num,order_num,id`, args, lock);
  const assignments = await rows(conn, `SELECT a.id,a.student_id,a.class_id,a.trainer_id,a.status,a.is_trial,
      a.paca_attendance_id,ps.id AS paca_student_id,ps.name,ps.school,ps.grade,ps.gender,ps.status AS paca_status,
      pa.id AS attendance_id,pa.attendance_status,cs.class_date,cs.time_slot AS attendance_slot,cs.is_closed
    FROM daily_assignments a JOIN students s ON s.id=a.student_id AND s.academy_id=a.academy_id
    JOIN ${paca}.students ps ON ps.id=s.paca_student_id AND ps.academy_id=a.academy_id AND ps.deleted_at IS NULL
    LEFT JOIN ${paca}.attendance pa ON pa.id=a.paca_attendance_id AND pa.student_id=ps.id
    LEFT JOIN ${paca}.class_schedules cs ON cs.id=pa.class_schedule_id AND cs.academy_id=a.academy_id
    WHERE a.academy_id=? AND a.date=? AND a.time_slot=? ORDER BY a.id`, args, lock);
  const plans = await rows(conn, `SELECT id,instructor_id,trainer_id,description,tags,exercises,
      completed_exercises,extra_exercises,exercise_times,conditions_checked FROM daily_plans
    WHERE academy_id=? AND date=? AND time_slot=? ORDER BY id`, args, lock);
  const holidays = await rows(conn, `SELECT id,title,is_all_day,start_time,end_time FROM ${paca}.academy_events
    WHERE academy_id=? AND event_date=? AND is_holiday=1 ORDER BY id`, [academy, date], lock);
  const classes = await rows(conn, `SELECT id,title,is_closed FROM ${paca}.class_schedules
    WHERE academy_id=? AND class_date=? AND time_slot=? ORDER BY id`, args, lock);
  const settings = await rows(conn, `SELECT morning_class_time,afternoon_class_time,evening_class_time
    FROM ${paca}.academy_settings WHERE academy_id=? ORDER BY id`, [academy], lock);
  return { instructors, owners, schedules, teachers, assignments, plans, holidays, classes, settings };
}
async function exercises(conn, academy, ids, lock = false) {
  const filter = ids ? ` AND id IN (${ids.map(() => '?').join(',')})` : '';
  if (ids?.length === 0) return [];
  return rows(conn, `SELECT id,name,tags,default_sets,default_reps,description FROM exercises
    WHERE (academy_id=? OR academy_id IS NULL)${filter} ORDER BY id`, [academy, ...(ids || [])], lock);
}
async function recordTypes(conn, academy) {
  return rows(conn, `SELECT id,name,unit,direction,min_value,max_value FROM record_types
    WHERE academy_id=? AND is_active=1 ORDER BY id`, [academy], false);
}
async function addInstructor(conn, academy, values, main, order) {
  return common.insert(conn, 'class_instructors', { academy_id: academy, date: values.date,
    time_slot: values.time_slot, class_num: values.class_num, instructor_id: values.instructor_id,
    is_main: main ? 1 : 0, order_num: order });
}
async function demoteMain(conn, academy, values) {
  await conn.execute(`UPDATE class_instructors SET is_main=0,order_num=COALESCE(order_num,0)+1
    WHERE academy_id=? AND date=? AND time_slot=? AND class_num=? AND is_main=1`,
  [academy, values.date, values.time_slot, values.class_num]);
}
async function assignStudents(conn, academy, values) {
  for (const [order, id] of (values.assignment_ids || []).entries()) {
    // Keep attendance, trial snapshots, status and trainer_id as the original app does.
    const [result] = await conn.execute(`UPDATE daily_assignments SET class_id=?,order_num=?
      WHERE id=? AND academy_id=? AND date=? AND time_slot=? AND class_id IS NULL`,
    [values.class_num, order, id, academy, values.date, values.time_slot]);
    if (result.affectedRows !== 1) fail(409, 'SOURCE_CHANGED', '학생 배정이 바뀌었습니다. 새 미리보기를 확인해 주세요.');
  }
}
module.exports = { state, exercises, recordTypes, addInstructor, demoteMain, assignStudents };
