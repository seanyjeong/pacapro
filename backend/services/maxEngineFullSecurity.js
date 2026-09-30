const crypto = require('crypto');
const config = require('../config/maxEngineFull');
const { fail } = require('../models/maxEngineError');
function key(purpose) {
  const value = config.signingKey();
  if (!value) fail(503, 'LINK_DISABLED', '전용 연동 키 설정이 필요합니다.');
  return crypto.createHmac('sha256', value).update(purpose).digest();
}
function stable(value) {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  }
  return value;
}
const digest = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key('full-preview-v1'), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
function unseal(token) {
  try {
    if (typeof token !== 'string' || token.length > 60000) throw new Error('format');
    const b = Buffer.from(token, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key('full-preview-v1'), b.subarray(0, 12));
    decipher.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString());
  } catch { fail(409, 'PREVIEW_INVALID', '미리보기가 유효하지 않습니다. 다시 확인해 주세요.'); }
}
function dataKey() {
  const value = config.dataKey();
  if (!value) fail(503, 'ENCRYPTION_UNAVAILABLE', '개인정보 암호화 설정이 필요합니다.');
  return value.length === 32 ? Buffer.from(value) : crypto.createHash('sha256').update(value).digest();
}
function encrypt(value) {
  if (value == null || value === '') return value;
  if (typeof value !== 'string' || value.startsWith('ENC:')) fail(422, 'INVALID_INPUT', '평문 입력을 확인해 주세요.');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  return 'ENC:' + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
function decrypt(value) {
  if (typeof value !== 'string' || !value.startsWith('ENC:')) return value;
  try {
    const b = Buffer.from(value.slice(4), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey(), b.subarray(0, 16));
    decipher.setAuthTag(b.subarray(16, 32));
    return Buffer.concat([decipher.update(b.subarray(32)), decipher.final()]).toString();
  } catch { fail(503, 'DECRYPT_FAILED', '자료 복호화 설정을 확인해 주세요.'); }
}
module.exports = { fail, digest, seal, unseal, encrypt, decrypt };
