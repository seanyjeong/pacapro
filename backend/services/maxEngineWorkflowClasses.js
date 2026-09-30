const rows = require('./maxEngineReadRows');
const { fields } = require('../constants/maxEngineWorkflows');
const { displays, scanLimit } = require('../constants/maxEngineReadOptions');
const { period, range, table, counts } = require('./maxEngineWorkflowInput');
const { fail } = require('./maxEngineFullSecurity');
async function schedules(actor, p) {
  let schedules = await rows.all(actor, 'paca', 'class_schedules', p.time_slot ? { time_slot: p.time_slot } : {},
    { columns: fields.schedule, ranges: range('class_date', period(p)) });
  if (p.start_time) {
    const [settings] = await rows.all(actor, 'paca', 'academy_settings', {},
      { columns: ['id', 'morning_class_time', 'afternoon_class_time', 'evening_class_time'] });
    schedules = schedules.filter(s => {
      const time = settings?.[`${s.time_slot}_class_time`];
      const match = typeof time === 'string' && time.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
      if (!match) fail(422, 'CLASS_TIME_UNKNOWN', '수업 시간 설정을 확인하거나 오전·오후·저녁 시간대로 조회해 주세요.');
      return match[1] < p.end_time && match[2] > p.start_time;
    });
  }
  return schedules.sort((a, b) => a.class_date.localeCompare(b.class_date) || a.id - b.id);
}
async function attendanceRows(actor, schedules, studentId) {
  const result = [];
  // One bounded batch per 200 schedules; never one query per student.
  for (let i = 0; i < schedules.length; i += 200) {
    result.push(...await rows.all(actor, 'paca', 'attendance', studentId ? { student_id: studentId } : {},
      { columns: fields.attendance, in: { class_schedule_id: schedules.slice(i, i + 200).map(s => s.id) } }));
    if (result.length > scanLimit) fail(422, 'QUERY_TOO_BROAD', '출결이 10,000행을 넘습니다. 조회 기간을 좁혀 주세요.');
  }
  return result;
}
async function classes(actor, p) {
  const list = await schedules(actor, p);
  const attendance = await attendanceRows(actor, list);
  const students = new Map((await rows.byIds(actor, 'paca', 'students', attendance.map(a => a.student_id), displays.students)).map(s => [s.id, s]));
  const classes = new Map((await rows.byIds(actor, 'paca', 'classes', list.map(s => s.class_id), displays.classes)).map(s => [s.id, s]));
  const instructors = new Map((await rows.byIds(actor, 'paca', 'instructors', list.map(s => s.instructor_id), displays.instructors)).map(s => [s.id, s]));
  const bySchedule = new Map();
  for (const a of attendance) {
    if (!students.has(a.student_id)) continue;
    if (!bySchedule.has(a.class_schedule_id)) bySchedule.set(a.class_schedule_id, []);
    bySchedule.get(a.class_schedule_id).push({ attendance_id: a.id, ...students.get(a.student_id), attendance_status: a.attendance_status });
  }
  return { date: p.date, roster_basis: 'attendance', ...table(list.map(s => ({ ...s,
    class_name: classes.get(s.class_id)?.class_name ?? null, instructor_name: instructors.get(s.instructor_id)?.name ?? null,
    students: table(bySchedule.get(s.id) || []) }))),
  notice: '수업별 출결 명단 기준입니다. 명단이 생성되지 않은 수업은 학생 0명으로 표시됩니다.' };
}
async function attendance(actor, p, studentId) {
  const span = period(p);
  const list = await schedules(actor, span);
  const all = await attendanceRows(actor, list, studentId);
  const filtered = p.status ? all.filter(r => (r.attendance_status ?? 'unmarked') === p.status) : all;
  const students = new Map((await rows.byIds(actor, 'paca', 'students', filtered.map(a => a.student_id), displays.students)).map(s => [s.id, s]));
  const scheduleMap = new Map(list.map(s => [s.id, s]));
  return { period: span, ...counts(filtered, 'attendance_status'), details: table(filtered.map(r => ({
    id: r.id, student: students.get(r.student_id) || null, date: scheduleMap.get(r.class_schedule_id).class_date,
    time_slot: scheduleMap.get(r.class_schedule_id).time_slot, status: r.attendance_status,
  }))) };
}
module.exports = { classes, attendance };
