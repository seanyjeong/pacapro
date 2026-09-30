const rows = require('./maxEngineReadRows');
const { fields } = require('../constants/maxEngineWorkflows');
const { displays } = require('../constants/maxEngineReadOptions');
const students = require('./maxEngineWorkflowStudents');
const { attendance } = require('./maxEngineWorkflowClasses');
const { payments } = require('./maxEngineWorkflowPayments');
const { period, table } = require('./maxEngineWorkflowInput');
async function overview(actor, p) {
  const resolved = await students.resolve(actor, 'paca', p);
  if (resolved.needs_selection) return resolved;
  const id = resolved.student.id;
  const [enrollment] = await rows.byIds(actor, 'paca', 'students', [id], ['id', ...fields.enrollment]);
  const registrations = await rows.all(actor, 'paca', 'student_classes', { student_id: id },
    { columns: ['id', 'class_id', 'assigned_date', 'status'] });
  const classes = new Map((await rows.byIds(actor, 'paca', 'classes', registrations.map(r => r.class_id), displays.classes)).map(r => [r.id, r]));
  const consultations = await rows.all(actor, 'paca', 'student_consultations', { student_id: id },
    { columns: ['id', 'consultation_date', 'consultation_type', 'general_memo'] });
  consultations.sort((a, b) => b.consultation_date.localeCompare(a.consultation_date) || b.id - a.id);
  return { ...resolved, enrollment, classes: table(registrations.map(r => ({ ...r, class_name: classes.get(r.class_id)?.class_name ?? null }))),
    attendance: await attendance(actor, period({}), id), recent_consultations: table(consultations, 3),
    unpaid: await payments(actor, {}, true, id) };
}
module.exports = { overview };
