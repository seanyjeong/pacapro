const repo = require('../repositories/maxEngineFullCommandRepository');
const { fail } = require('./maxEngineFullSecurity');

async function state(conn, actor, command, lock) {
  const record = command.operation.endsWith('_create') ? null :
    await repo.row(conn, 'student_consultations', command.resource_id, actor.academy_id, lock);
  const student = await repo.row(conn, 'students', record?.student_id || command.changes.student_id, actor.academy_id, lock);
  const cid = record?.consultation_id || command.changes.consultation_id;
  const consultation = cid ? await repo.row(conn, 'consultations', cid, actor.academy_id, lock) : null;
  if (consultation && Number(consultation.linked_student_id) !== student.id) fail(409, 'STUDENT_MISMATCH', '상담과 학생 연결을 확인해 주세요.');
  return { record, student, consultation };
}
function values(changes) {
  return Object.fromEntries(Object.entries(changes).map(([k, v]) => [k,
    ['mock_test_scores', 'physical_records'].includes(k) && v !== null ? JSON.stringify(v) : v]));
}
async function create(conn, actor, changes) {
  const id = await repo.insert(conn, 'student_consultations', { ...values(changes), academy_id: actor.academy_id, created_by: actor.user_id });
  if (changes.consultation_id) await repo.update(conn, 'consultations', changes.consultation_id, { status: 'completed' });
  return id;
}
async function update(conn, id, changes) { await repo.update(conn, 'student_consultations', id, values(changes)); return id; }
module.exports = { state, create, update };
