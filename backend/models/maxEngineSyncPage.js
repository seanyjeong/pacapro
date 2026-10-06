const crypto = require('crypto');
const { fail } = require('./maxEngineError');
function iso(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    fail(422, 'SYNC_INVALID_QUERY', 'updated_since는 시간대가 포함된 ISO8601 날짜여야 합니다.');
  }
  if (new Date(value.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) !== value.slice(0, 10)) {
    fail(422, 'SYNC_INVALID_QUERY', 'updated_since 날짜가 실제 달력에 존재하지 않습니다.');
  }
  return new Date(value).toISOString();
}
function mac(payload, key) { return crypto.createHmac('sha256', key).update(payload).digest('base64url'); }
function cursor(payload, key) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return data + '.' + mac(data, key);
}
function query(input, key) {
  if (Object.keys(input).some(k => !['academy_id', 'updated_since', 'cursor'].includes(k)) ||
      typeof input.academy_id !== 'string' || !/^[1-9]\d*$/.test(input.academy_id) || !Number.isSafeInteger(Number(input.academy_id))) {
    fail(422, 'SYNC_INVALID_QUERY', '양의 정수 academy_id와 updated_since·cursor만 지정해 주세요.');
  }
  const academyId = Number(input.academy_id), since = input.updated_since === undefined ? null : iso(input.updated_since);
  if (input.cursor === undefined) return { academyId, since, after: null, watermark: null };
  try {
    if (typeof input.cursor !== 'string' || input.cursor.length > 2000) throw new Error('format');
    const [data, signature, extra] = input.cursor.split('.');
    const expected = mac(data, key);
    if (extra || !signature || signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('signature');
    const page = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (page.academyId !== academyId || page.since !== since ||
        !page.after || !Number.isSafeInteger(page.after.id) || page.after.id < 1 ||
        typeof page.after.updated_at !== 'string') throw new Error('scope');
    iso(page.watermark);
    return { academyId, since, after: page.after, watermark: page.watermark };
  } catch { fail(422, 'SYNC_INVALID_CURSOR', 'cursor가 유효하지 않거나 교육원·updated_since가 다릅니다. 첫 페이지부터 다시 조회해 주세요.'); }
}
function authenticate(key, header, socketAddress, headers) {
  if (!key) fail(503, 'SYNC_DISABLED', 'MAX_ENGINE_SYNC_KEY가 없어 자동 가져오기 경로가 비활성 상태입니다.');
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(socketAddress);
  if (!local || ['forwarded', 'x-forwarded-for', 'x-real-ip'].some(k => Object.hasOwn(headers, k))) {
    fail(403, 'SYNC_INTERNAL_ONLY', '동기화 경로는 같은 서버의 직접 내부 호출만 허용합니다.');
  }
  if (typeof header !== 'string' || header.length > 1024 || !crypto.timingSafeEqual(
    crypto.createHash('sha256').update(header).digest(), crypto.createHash('sha256').update(key).digest())) {
    fail(401, 'SYNC_UNAUTHORIZED', '동기화 인증 키가 유효하지 않습니다.');
  }
}
// PACA MySQL TIMESTAMP strings use the existing +09:00 connection timezone.
function mysqlToIso(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value).replace(' ', 'T') + '+09:00').toISOString();
}
function isoToMysql(value) {
  return new Date(Date.parse(value) + 9 * 3600 * 1000).toISOString().slice(0, 23).replace('T', ' ');
}
module.exports = { authenticate, query, cursor, mysqlToIso, isoToMysql };
