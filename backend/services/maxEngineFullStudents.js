const repo = require('../repositories/maxEngineFullCommandRepository');
const { encryptedFields } = require('../constants/maxEngineCommands');
const { encrypt, decrypt, fail } = require('./maxEngineFullSecurity');
const { STUDENT_PARENT_PHONE_FIELDS } = require('../constants/studentParentPhones');
const { prepareStudentParentContacts, StudentParentContactValidationError } = require('./studentParentContactService');
const { validateStudentProfileFields } = require('./studentProfileValidationService');

function parentPhones(changes) {
  const input = Object.fromEntries(STUDENT_PARENT_PHONE_FIELDS
    .filter(field => changes[field] !== undefined).map(field => [field, changes[field]]));
  try { return prepareStudentParentContacts(input); }
  catch (error) {
    if (error instanceof StudentParentContactValidationError) fail(422, 'INVALID_INPUT', error.message);
    throw error;
  }
}
function normalizeParentPhones(changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return changes;
  return { ...changes, ...parentPhones(changes).values };
}

function encrypted(changes) {
  const contacts = parentPhones(changes);
  const profile = Object.entries(changes).filter(([field]) => !STUDENT_PARENT_PHONE_FIELDS.includes(field));
  return { ...Object.fromEntries(profile.map(([k, v]) => [k, encryptedFields.includes(k) ? encrypt(v) : v])),
    ...contacts.encrypted };
}
function validateCreate(changes, roster) {
  validateAdmission(changes);
  const phone = changes.phone.replace(/\D/g, '');
  if (roster.some(s => !s.deleted_at && decrypt(s.name) === changes.name && String(decrypt(s.phone) || '').replace(/\D/g, '') === phone)) {
    fail(409, 'DUPLICATE_STUDENT', '같은 이름과 전화번호의 학생이 있습니다. 기존 학생을 확인해 주세요.');
  }
}
async function create(conn, actor, changes, before) {
  validateCreate(changes, before);
  const { registration_source: registrationSource, ...profile } = changes;
  const isProspect = registrationSource === 'max_engine';
  const memo = isProspect ? ['엔진등록', profile.memo].filter(Boolean).join('\n') : profile.memo;
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date());
  const numbers = before.map(s => String(s.student_number || '')).filter(n => new RegExp(`^${year}\\d+$`).test(n));
  const next = Math.max(0, ...numbers.map(n => Number(n.slice(4)))) + 1;
  return repo.insert(conn, 'students', { ...encrypted(profile), ...(memo !== undefined ? { memo } : {}), academy_id: actor.academy_id,
    student_number: year + String(next).padStart(3, '0'), student_type: 'exam', admission_type: profile.admission_type || 'regular',
    status: isProspect ? 'prospect' : 'active', class_days: '[]', weekly_count: 0, monthly_tuition: 0, is_trial: 0 });
}
async function update(conn, id, changes) { await repo.update(conn, 'students', id, encrypted(changes)); return id; }
function validateAdmission(changes, currentStudent) {
  if (!Object.hasOwn(changes, 'admission_type')) return;
  const result = validateStudentProfileFields({ admissionType: changes.admission_type,
    currentStudent, grade: changes.grade });
  if (result.error) fail(422, 'INVALID_INPUT', result.error);
}
module.exports = { create, update, validateCreate, validateAdmission, normalizeParentPhones };
