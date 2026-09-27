const rows = require('./maxEngineReadRows');
const { fields } = require('../constants/maxEngineWorkflows');
const students = require('./maxEngineWorkflowStudents');
const { period, range, table } = require('./maxEngineWorkflowInput');
const { fail } = require('./maxEngineFullSecurity');
async function records(actor, p, mode) {
  let student;
  if (p.student_id || p.name) {
    const resolved = await students.resolve(actor, 'peak', p);
    if (resolved.needs_selection) return resolved;
    student = resolved.student;
  }
  const events = await rows.all(actor, 'peak', 'record_types', {}, { columns: fields.event });
  const matches = p.event ? events.filter(e => e.name === p.event) : events;
  if (p.event && !matches.length) fail(404, 'EVENT_NOT_FOUND', '현재 교육원에서 종목을 찾지 못했습니다.');
  if (p.event && matches.length > 1) fail(409, 'EVENT_AMBIGUOUS', '같은 이름의 종목이 여러 개입니다. 종목 설정을 확인해 주세요.');
  const event = matches[0];
  if (mode !== 'recent_records' && !['higher', 'lower'].includes(event.direction)) fail(409, 'EVENT_DIRECTION_UNKNOWN', '종목의 기록 우열 기준을 확인해 주세요.');
  const span = period(p);
  const result = await rows.all(actor, 'peak', 'student_records', {
    ...(student ? { student_id: student.id } : {}), ...(p.event ? { record_type_id: event.id } : {}),
  }, { columns: fields.record, ranges: range('measured_at', span) });
  const studentMap = new Map((await students.peakStudents(actor, result.map(r => r.student_id))).map(s => [s.id, s]));
  const eventMap = new Map(events.map(e => [e.id, e]));
  const visible = result.filter(r => studentMap.has(r.student_id) && eventMap.has(r.record_type_id) &&
    (!p.gender || studentMap.get(r.student_id).gender === p.gender) &&
    (mode !== 'event_ranking' || studentMap.get(r.student_id).status === 'active') &&
    r.value !== null && Number.isFinite(Number(r.value)))
    .map(r => ({ id: r.id, student: studentMap.get(r.student_id), event: eventMap.get(r.record_type_id),
      date: r.measured_at, value: Number(r.value) }));
  visible.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  if (mode === 'recent_records') return { period: span, ...table(visible.reverse()) };
  const better = (a, b) => event.direction === 'lower' ? a < b : a > b;
  if (mode === 'student_progress') {
    const first = visible[0]?.value ?? null, latest = visible.at(-1)?.value ?? null;
    const best = visible.reduce((best, r) => best === null || better(r.value, best) ? r.value : best, null);
    return { student, event, period: span, first, latest, best,
      improvement: first === null ? null : Number(((latest - first) * (event.direction === 'lower' ? -1 : 1)).toFixed(4)),
      records: table([...visible].reverse()), record_order: 'newest_first' };
  }
  // Existing PEAK leaderboard uses the latest record and active PACA students.
  const latest = new Map();
  for (const r of visible) latest.set(r.student.id, r);
  const ranked = [...latest.values()].sort((a, b) => (event.direction === 'lower' ? a.value - b.value : b.value - a.value) || a.student.id - b.student.id);
  return { event, period: span, gender: p.gender ?? null, basis: 'latest_per_active_student',
    tie_rule: 'ordinal_student_id', ...table(ranked.map((r, i) => ({ rank: i + 1, ...r }))) };
}
module.exports = { records };
