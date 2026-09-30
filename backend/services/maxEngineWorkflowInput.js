const { workflows } = require('../constants/maxEngineWorkflows');
const { detailLimit } = require('../constants/maxEngineReadOptions');
const { fail } = require('./maxEngineFullSecurity');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
function invalid(message) { fail(422, 'INVALID_QUERY', message); }
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value) invalid('실제 날짜를 YYYY-MM-DD로 지정해 주세요.');
  return value;
}
function validate(provider, workflow, input) {
  const allowed = Object.hasOwn(workflows[provider] || {}, workflow) ? workflows[provider][workflow] : null;
  if (!allowed) fail(404, 'WORKFLOW_NOT_FOUND', '허용된 업무 조회가 아닙니다.');
  if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(k => !allowed.includes(k))) invalid('허용된 업무 조회 조건을 확인해 주세요.');
  const p = { ...input };
  for (const [key, value] of Object.entries(p)) {
    if (key === 'student_id') {
      if (!Number.isSafeInteger(value) || value <= 0) invalid('학생 id는 양의 정수여야 합니다.');
    } else if (typeof value !== 'string' || !value.trim() || value.length > 100) invalid('조회 조건은 1~100자 문자열이어야 합니다.');
    else p[key] = value.trim();
  }
  for (const key of ['date', 'start_date', 'end_date']) if (p[key]) day(p[key]);
  if (p.date && (p.start_date || p.end_date)) invalid('date 또는 start_date·end_date 중 하나만 지정해 주세요.');
  if (Boolean(p.start_date) !== Boolean(p.end_date)) invalid('기간의 시작일과 종료일을 함께 지정해 주세요.');
  if (p.start_date && p.start_date > p.end_date) invalid('시작일이 종료일보다 늦습니다.');
  if (p.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)) invalid('월은 YYYY-MM 형식이어야 합니다.');
  if (['unpaid_list', 'payment_status'].includes(workflow) && !p.month) invalid('조회할 month를 지정해 주세요.');
  if (workflow === 'classes_with_students' && !p.date) invalid('수업 날짜를 지정해 주세요.');
  if (['attendance_summary', 'consultation_schedule'].includes(workflow) && !p.date && !p.start_date) invalid('날짜 또는 기간을 지정해 주세요.');
  if (p.time_slot && !['morning', 'afternoon', 'evening'].includes(p.time_slot)) invalid('시간대는 morning·afternoon·evening 중 하나입니다.');
  for (const k of ['start_time', 'end_time']) if (p[k] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p[k])) invalid('시간은 HH:MM 형식이어야 합니다.');
  if (Boolean(p.start_time) !== Boolean(p.end_time) || (p.start_time && (p.time_slot || p.start_time >= p.end_time))) invalid('시간대 또는 같은 날의 시작·종료 시간을 지정해 주세요.');
  if (p.phone_last4 && !/^\d{4}$/.test(p.phone_last4)) invalid('전화번호 끝 네 자리를 지정해 주세요.');
  if (p.gender && !['male', 'female'].includes(p.gender)) invalid('성별은 male·female 중 하나입니다.');
  if (p.student_id && p.name) invalid('학생 id 또는 이름 하나만 지정해 주세요.');
  if (['student_overview', 'student_progress'].includes(workflow) && !p.student_id && !p.name) invalid('학생 id 또는 이름이 필요합니다.');
  if (['event_ranking', 'student_progress'].includes(workflow) && !p.event) invalid('종목 이름을 지정해 주세요.');
  if (workflow === 'student_search' && !Object.keys(p).length) invalid('이름·전화 끝4자리·학년·학교 중 한 가지 이상 지정해 주세요.');
  return p;
}
function period(p, days = 30) {
  if (p.date) return { start_date: p.date, end_date: p.date };
  if (p.start_date) return { start_date: p.start_date, end_date: p.end_date };
  const end = today(), start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start_date: start.toISOString().slice(0, 10), end_date: end };
}
function range(column, p) { return [[column, p.start_date, p.end_date]]; }
function table(items, limit = detailLimit) { return { items: items.slice(0, limit), total: items.length, truncated: items.length > limit }; }
function pick(row, columns) { return Object.fromEntries(columns.map(k => [k, row[k] ?? null])); }
function counts(rows, key) {
  const result = Object.create(null);
  for (const row of rows) { const value = row[key] ?? 'unmarked'; result[value] = (result[value] || 0) + 1; }
  return { total: rows.length, by_status: result };
}
module.exports = { validate, today, period, range, table, pick, counts };
