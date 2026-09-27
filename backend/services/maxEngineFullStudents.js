const repo = require('../repositories/maxEngineFullCommandRepository');
const { encryptedFields } = require('../constants/maxEngineCommands');
const { encrypt, decrypt, fail } = require('./maxEngineFullSecurity');

function encrypted(changes) {
  return Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, encryptedFields.includes(k) ? encrypt(v) : v]));
}
function validateCreate(changes, roster) {
  const phone = changes.phone.replace(/\D/g, '');
  if (roster.some(s => !s.deleted_at && decrypt(s.name) === changes.name && String(decrypt(s.phone) || '').replace(/\D/g, '') === phone)) {
    fail(409, 'DUPLICATE_STUDENT', '같은 이름과 전화번호의 학생이 있습니다. 기존 학생을 확인해 주세요.');
  }
}
async function create(conn, actor, changes, before) {
  validateCreate(changes, before);
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date());
  const numbers = before.map(s => String(s.student_number || '')).filter(n => new RegExp(`^${year}\\d+$`).test(n));
  const next = Math.max(0, ...numbers.map(n => Number(n.slice(4)))) + 1;
  return repo.insert(conn, 'students', { ...encrypted(changes), academy_id: actor.academy_id,
    student_number: year + String(next).padStart(3, '0'), student_type: 'exam', admission_type: 'regular',
    status: 'active', class_days: '[]', weekly_count: 0, monthly_tuition: 0, is_trial: 0 });
}
async function update(conn, id, changes) { await repo.update(conn, 'students', id, encrypted(changes)); return id; }
module.exports = { create, update, validateCreate };
