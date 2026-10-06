const config = require('../config/maxEngineSync');
const repository = require('../repositories/maxEngineSyncRepository');
const { fail } = require('../models/maxEngineError');
const { authenticate, query, cursor, mysqlToIso } = require('../models/maxEngineSyncPage');
// Reuse the existing strict crypto helper; legacy utils/encryption returns
// ciphertext on failure, which must never be exported as a student's name.
const { decrypt } = require('./maxEngineFullSecurity');

async function students(input, header, socketAddress, headers) {
  const key = config.signingKey(), academies = config.academyIds();
  if (!key || !academies) {
    fail(503, 'SYNC_DISABLED', '동기화 공유 키와 교육원 허용 목록 설정이 필요합니다.');
  }
  authenticate(key, header, socketAddress, headers);
  const page = query(input, key);
  if (!academies.has(page.academyId)) {
    fail(403, 'SYNC_ACADEMY_FORBIDDEN', '자동 가져오기를 허용한 교육원이 아닙니다.');
  }
  page.watermark = page.watermark || await repository.serverTime();
  const rows = await repository.students(page), selected = rows.slice(0, config.pageSize);
  const items = selected.map(row => ({
    paca_student_id: row.id, academy_id: row.academy_id,
    name: decrypt(row.name), gender: row.gender, school_name: row.school,
    grade: row.grade, phone: decrypt(row.phone), parent_phone: decrypt(row.parent_phone),
    admission_type: row.admission_type, status: row.status,
    deleted_at: mysqlToIso(row.deleted_at), updated_at: mysqlToIso(row.updated_at),
  }));
  const last = selected[selected.length - 1];
  const next = rows.length > config.pageSize ? cursor({
    academyId: page.academyId, since: page.since, watermark: page.watermark,
    after: { id: last.id, updated_at: last.updated_at },
  }, key) : null;
  return { items, next_cursor: next, server_time: page.watermark };
}
module.exports = { students };
