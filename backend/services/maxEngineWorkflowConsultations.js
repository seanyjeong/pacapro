const rows = require('./maxEngineReadRows');
const { fields } = require('../constants/maxEngineWorkflows');
const { displays } = require('../constants/maxEngineReadOptions');
const { period, range, table } = require('./maxEngineWorkflowInput');
async function schedule(actor, p) {
  const span = period(p);
  const items = await rows.all(actor, 'paca', 'consultations', p.status ? { status: p.status } : {},
    { columns: fields.consultation, ranges: range('preferred_date', span) });
  const students = new Map((await rows.byIds(actor, 'paca', 'students', items.map(r => r.linked_student_id), displays.students)).map(s => [s.id, s]));
  // A stale linked student must not leak a previous academy's cached name.
  const visible = items.filter(r => !r.linked_student_id || students.has(r.linked_student_id));
  visible.sort((a, b) => `${a.preferred_date} ${a.preferred_time}`.localeCompare(`${b.preferred_date} ${b.preferred_time}`) || a.id - b.id);
  return { period: span, ...table(visible.map(r => ({ id: r.id, date: r.preferred_date, time: r.preferred_time,
    status: r.status, type: r.consultation_type,
    student: r.linked_student_id ? students.get(r.linked_student_id) : { id: null, name: r.student_name, grade: r.student_grade, school: r.student_school },
  }))) };
}
module.exports = { schedule };
