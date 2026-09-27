const rows = require('./maxEngineReadRows');
const { fields } = require('../constants/maxEngineWorkflows');
const { table, pick } = require('./maxEngineWorkflowInput');
const { fail } = require('./maxEngineFullSecurity');
async function peakStudents(actor, ids) {
  const columns = ['id', 'paca_student_id'];
  const linked = ids ? await rows.byIds(actor, 'peak', 'students', ids, columns)
    : await rows.all(actor, 'peak', 'students', {}, { columns });
  const current = new Map((await rows.byIds(actor, 'paca', 'students', linked.map(s => s.paca_student_id), fields.student))
    .map(s => [s.id, s]));
  return linked.filter(s => current.has(s.paca_student_id)).map(s => ({ ...current.get(s.paca_student_id), id: s.id }));
}
async function search(actor, provider, p, exact = false) {
  const columns = [...fields.student, ...(p.phone_last4 ? ['phone'] : [])];
  const students = provider === 'peak' ? await peakStudents(actor, p.student_id ? [p.student_id] : undefined)
    : await rows.all(actor, provider, 'students', p.student_id ? { id: p.student_id } : {}, { columns });
  return students.filter(s => (!p.name || (exact ? s.name === p.name : s.name?.includes(p.name))) &&
    (!p.grade || s.grade === p.grade) && (!p.school || s.school?.includes(p.school)) &&
    (!p.phone_last4 || s.phone?.replace(/\D/g, '').endsWith(p.phone_last4)))
    .map(s => pick(s, fields.student));
}
async function resolve(actor, provider, p) {
  const matches = await search(actor, provider, p, true);
  if (!matches.length) fail(404, 'STUDENT_NOT_FOUND', '현재 교육원에서 학생을 찾지 못했습니다.');
  if (matches.length > 1) return { needs_selection: true, candidates: table(matches), message: '동명이인입니다. student_id로 다시 조회해 주세요.' };
  return { student: matches[0] };
}
async function trial(actor, p) {
  const students = await rows.all(actor, 'paca', 'students', p.status ? { status: p.status } : {},
    { columns: [...fields.student, 'is_trial', 'trial_remaining', 'trial_dates'] });
  return table(students.filter(s => {
    const dates = typeof s.trial_dates === 'string' ? JSON.parse(s.trial_dates) : s.trial_dates;
    return s.is_trial === 1 || s.status === 'trial' || (Array.isArray(dates) && dates.length > 0);
  }));
}
module.exports = { search, resolve, trial, peakStudents };
