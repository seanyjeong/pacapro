const { commands } = require('../constants/maxEngineTrialCommands');
const repo = require('../repositories/maxEngineTrialRepository');
const { fail, decrypt } = require('./maxEngineFullSecurity');
const { parseTrialDates, prepareTrialActivation, getKoreaDateText, TrialStatusValidationError } = require('./trialStatusService');
const key = item => `${item.date || item.class_date}/${item.time_slot}`;
const supports = operation => Object.hasOwn(commands, operation);
const conflict = message => fail(409, 'TRIAL_CONFLICT', message);
function plan(command, before) {
  const { student, attendance, schedules, holidays } = before;
  const today = before.today || getKoreaDateText();
  if (!['pending', 'prospect', 'trial'].includes(student.status)) conflict('미등록·예비·체험 학생만 체험 등록과 일정 변경이 가능합니다.');
  if (command.operation === 'trial_register' && student.status === 'trial') conflict('현재 체험생입니다. 체험 일정 추가·수정을 사용해 주세요.');
  let dates;
  try { dates = parseTrialDates(student.trial_dates ?? [], { strict: true }); }
  catch (error) {
    if (error instanceof TrialStatusValidationError) conflict('기존 체험 일정의 날짜·시간대가 불완전합니다. 학원관리에서 먼저 확인해 주세요.');
    throw error;
  }
  const marked = item => item.attended || attendance.some(a => key(a) === key(item) && a.attendance_status !== null);
  const incoming = command.changes.trial_dates || [{ date: command.changes.date, time_slot: command.changes.time_slot }];
  for (const item of incoming) {
    if (item.date < today) fail(422, 'INVALID_INPUT', '오늘 또는 이후의 체험 날짜를 선택해 주세요.');
    const matching = schedules.filter(s => key(s) === key(item));
    if (matching.length > 1) conflict('같은 날짜·시간대에 여러 수업이 있습니다. 학원관리에서 수업을 먼저 정리해 주세요.');
    if (matching.some(s => s.is_closed || s.academy_event_id) || holidays.some(h => h.event_date === item.date)) conflict('휴일·휴강 일정에는 체험을 배정할 수 없습니다.');
  }
  const removedKeys = new Set();
  if (command.operation === 'trial_register') {
    // Keep historical and checked attendance; only replace unmarked upcoming reservations.
    dates = dates.filter(item => {
      if (item.date < today || marked(item)) return true;
      removedKeys.add(key(item)); return false;
    });
  } else if (command.operation === 'trial_schedule_update') {
    const target = `${command.changes.previous_date}/${command.changes.previous_time_slot}`;
    const matches = dates.filter(item => key(item) === target);
    if (matches.length !== 1) conflict('수정할 체험 일정 한 건을 정확히 선택해 주세요.');
    if (matches[0].date < today || marked(matches[0])) conflict('지난 일정 또는 출결이 기록된 체험 일정은 이동할 수 없습니다.');
    removedKeys.add(target);
    dates = dates.filter(item => key(item) !== target);
  }
  const keys = new Set(dates.map(key));
  for (const item of incoming) {
    if (keys.has(key(item))) conflict('이미 등록된 체험 날짜·시간대입니다.');
    if (attendance.some(a => key(a) === key(item) && (a.attendance_status !== null || a.is_makeup))) conflict('선택한 일정에 출결 또는 보강 배정이 있습니다.');
    keys.add(key(item)); dates.push({ ...item, attended: false });
  }
  dates.sort((a, b) => a.date.localeCompare(b.date) || a.time_slot?.localeCompare(b.time_slot || '') || 0);
  let resolved;
  try { resolved = prepareTrialActivation(dates, { today }); }
  catch (error) {
    if (error instanceof TrialStatusValidationError) fail(422, 'INVALID_INPUT', error.message);
    throw error;
  }
  const retained = new Set(dates.map(key));
  const removed = attendance.filter(a => removedKeys.has(key(a)) && !retained.has(key(a)) && a.attendance_status === null);
  if (removed.some(a => a.is_makeup)) conflict('보강 배정과 연결된 체험 일정은 먼저 학원관리에서 확인해 주세요.');
  const assigned = incoming.filter(item => !attendance.some(a => key(a) === key(item)));
  return { status: resolved.status, is_trial: 1, trial_remaining: resolved.trialRemaining, trial_dates: dates,
    related: { remove_attendance: removed, assign_schedules: assigned, billing_changed: false } };
}
function display(command, before) {
  const after = plan(command, before);
  const s = before.student;
  const identity = { student_id: s.id, name: decrypt(s.name) };
  return { before: { ...identity, status: s.status, is_trial: s.is_trial, trial_remaining: s.trial_remaining,
    trial_dates: parseTrialDates(s.trial_dates) },
  after: { ...identity, ...after, class_times: before.settings[0] || null }, notice: commands[command.operation].notice };
}
async function apply(conn, actor, command, before) {
  return repo.apply(conn, actor, command.resource_id, plan(command, before), before);
}
async function state(conn, actor, command, lock) {
  // A KST day change can change the remaining count even without a database write.
  return { ...await repo.state(conn, actor, command, lock), today: getKoreaDateText() };
}
module.exports = { supports, state, display, apply, plan };
