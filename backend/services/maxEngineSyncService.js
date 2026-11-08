const config = require('../config/maxEngineSync');
const repository = require('../repositories/maxEngineSyncRepository');
const { fail } = require('../models/maxEngineError');
const { authenticate, query, cursor, mysqlToIso } = require('../models/maxEngineSyncPage');
// Reuse the existing strict crypto helper; legacy utils/encryption returns
// ciphertext on failure, which must never be exported as a student's name.
const { decrypt } = require('./maxEngineFullSecurity');
const { linkedAcademy } = require('./maxEngineService');

async function allowed(academies, academyId, headers) {
  // env 허용 목록 또는 맥스엔진 연결 토큰(X-Max-Engine-Link) — 연결한 학원은 목록 수작업 없이 바로 허용
  if (!academies.has(academyId) && await linkedAcademy(headers['x-max-engine-link']) !== academyId) {
    fail(403, 'SYNC_ACADEMY_FORBIDDEN', '자동 가져오기를 허용한 교육원이 아닙니다.');
  }
}

function enabled() {
  const key = config.signingKey(), academies = config.academyIds();
  if (!key || !academies) {
    fail(503, 'SYNC_DISABLED', '동기화 공유 키와 교육원 허용 목록 설정이 필요합니다.');
  }
  return { key, academies };
}

async function students(input, header, socketAddress, headers) {
  const { key, academies } = enabled();
  authenticate(key, header, socketAddress, headers);
  const page = query(input, key);
  await allowed(academies, page.academyId, headers);
  page.watermark = page.watermark || await repository.serverTime();
  const rows = await repository.students(page), selected = rows.slice(0, config.pageSize);
  const items = selected.map(row => ({
    paca_student_id: row.id, academy_id: row.academy_id,
    name: decrypt(row.name), gender: row.gender, school_name: row.school,
    grade: row.grade, phone: decrypt(row.phone), parent_phone: decrypt(row.parent_phone),
    father_phone: decrypt(row.father_phone), mother_phone: decrypt(row.mother_phone),
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
function positive(value, name) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    fail(422, 'SYNC_INVALID_QUERY', `${name}는 양의 정수여야 합니다.`);
  }
  return Number(value);
}

/**
 * 시즌 날짜와 학생 시즌 등록(맥스엔진 DL 시즌 단계). 읽기 전용·같은 키·같은 교육원 범위.
 * 시즌: 끝나지 않았거나(status != 'ended') 끝난 지 1년 안. 등록: 그 시즌들의 student_seasons — 학생은 같은 교육원 학생 번호만, 이름·전화 등 개인정보 칸 없음.
 * paca_student_id 를 주면 그 학생 등록만. offset 으로 등록 쪽을 쪽 나눔(next_offset).
 */
async function seasons(input, header, socketAddress, headers) {
  const { key, academies } = enabled();
  authenticate(key, header, socketAddress, headers);
  if (Object.keys(input).some(k => !['academy_id', 'paca_student_id', 'offset'].includes(k))) {
    fail(422, 'SYNC_INVALID_QUERY', 'academy_id와 paca_student_id·offset만 지정해 주세요.');
  }
  const academyId = positive(input.academy_id, 'academy_id');
  const studentId = input.paca_student_id === undefined ? null : positive(input.paca_student_id, 'paca_student_id');
  const offset = input.offset === undefined ? 0 : input.offset === '0' ? 0 : positive(input.offset, 'offset');
  await allowed(academies, academyId, headers);
  const rows = await repository.seasons(academyId);
  const ids = rows.map(r => r.id);
  const regs = ids.length ? await repository.studentSeasons(academyId, ids, studentId, offset) : [];
  const size = repository.SEASON_PAGE_SIZE;
  const page = regs.slice(0, size);
  return {
    academy_id: academyId,
    seasons: rows.map(r => ({ id: r.id, season_name: r.season_name, season_type: r.season_type, status: r.status,
      season_start_date: r.season_start_date, season_end_date: r.season_end_date, non_season_end_date: r.non_season_end_date })),
    student_seasons: page.map(r => ({ season_id: r.season_id, paca_student_id: r.student_id, registration_date: r.registration_date,
      payment_status: r.payment_status, is_cancelled: Boolean(r.is_cancelled) })),
    next_offset: regs.length > size ? offset + size : null,
  };
}
module.exports = { students, seasons };
