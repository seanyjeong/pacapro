const { encrypt, decrypt } = require('../utils/encryption');
function seal(value) {
  const encrypted = encrypt(value);
  if (!encrypted?.startsWith('ENC:')) throw new Error('Admission encryption unavailable');
  return encrypted;
}
function open(value) {
  const result = decrypt(value);
  if (typeof result !== 'string' || result.startsWith('ENC:')) throw new Error('Admission decryption unavailable');
  return result;
}
const json = value => typeof value === 'string' ? JSON.parse(value) : value;
function view(row) {
  return { id: row.id, status: row.status, revision: row.revision, profile: JSON.parse(open(row.profile_encrypted)),
    enrollment_date: row.enrollment_date, terms: json(row.terms_json), quote: json(row.quote_json),
    student_id: row.student_id, review_code: row.review_code, created_at: row.created_at };
}
module.exports = { seal, open, json, view };
