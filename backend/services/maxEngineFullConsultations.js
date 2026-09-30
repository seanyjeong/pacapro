const repo = require('../repositories/maxEngineFullCommandRepository');
const { encrypt, decrypt, fail } = require('./maxEngineFullSecurity');

function validate(student) {
  if (!/^(초[1-6]|중[1-3]|고[1-3]|N수|성인)$/.test(student.grade || '')) {
    fail(422, 'STUDENT_GRADE_REQUIRED', '학생 학년을 먼저 확인해 주세요.');
  }
}
async function create(conn, actor, changes, student) {
  validate(student);
  const { student_id, ...fields } = changes;
  const id = await repo.insert(conn, 'consultations', { ...fields,
    preferred_time: fields.preferred_time + ':00', academy_id: actor.academy_id,
    consultation_type: 'learning', linked_student_id: student_id,
    student_name: encrypt(decrypt(student.name)), student_grade: student.grade, status: 'confirmed' });
  await repo.insert(conn, 'student_consultations', { academy_id: actor.academy_id, student_id,
    consultation_id: id, consultation_date: changes.preferred_date, consultation_type: changes.learning_type,
    general_memo: changes.admin_notes || null, created_by: actor.user_id });
  return id;
}
async function update(conn, actor, id, changes) {
  await repo.update(conn, 'consultations', id, changes);
  return id;
}
module.exports = { create, update, validate };
