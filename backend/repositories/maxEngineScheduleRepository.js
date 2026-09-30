const commandRepo = require('./maxEngineFullCommandRepository');
const eventRepo = require('./academyEventRepository');
const { fail } = require('../models/maxEngineError');

async function rows(conn, sql, params, lock) {
  const [result] = await conn.execute(sql + (lock ? ' FOR UPDATE' : ''), params);
  return result;
}
async function instructor(conn, id, academyId, lock) {
  if (id == null) return null;
  const found = await rows(conn, 'SELECT id, academy_id, deleted_at FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL', [id, academyId], lock);
  if (!found[0]) fail(404, 'NOT_FOUND', '내 교육원의 재직 강사를 찾을 수 없습니다.');
  return found[0];
}
async function classState(conn, actor, command, lock) {
  const record = await commandRepo.row(conn, 'class_schedules', command.resource_id, actor.academy_id, lock);
  const after = { ...record, ...command.changes }, academy = actor.academy_id;
  const attendance = await rows(conn, `SELECT a.id, a.attendance_status, a.is_makeup, s.academy_id, s.is_trial, s.status, s.trial_dates
    FROM attendance a LEFT JOIN students s ON s.id = a.student_id
    WHERE a.class_schedule_id = ? ORDER BY a.id`, [record.id], lock);
  if (attendance.some(row => row.academy_id !== academy)) fail(404, 'NOT_FOUND', '수업에 연결된 학생의 교육원 정보를 확인해 주세요.');
  return { record, instructor: await instructor(conn, after.instructor_id, academy, lock),
    duplicates: await rows(conn, 'SELECT id FROM class_schedules WHERE academy_id = ? AND class_date = ? AND time_slot = ? AND id <> ? ORDER BY id', [academy, after.class_date, after.time_slot, record.id], lock),
    holidays: await rows(conn, 'SELECT id FROM academy_events WHERE academy_id = ? AND event_date = ? AND is_holiday = 1 ORDER BY id', [academy, after.class_date], lock),
    attendance,
    instructorAttendance: await rows(conn, 'SELECT id, work_date, time_slot, attendance_status FROM instructor_attendance WHERE class_schedule_id = ? ORDER BY id', [record.id], lock),
    notifications: await rows(conn, 'SELECT id, status FROM attendance_notification_queue WHERE class_schedule_id = ? ORDER BY id', [record.id], lock) };
}
async function instructorState(conn, actor, command, lock) {
  const record = await commandRepo.row(conn, 'instructor_schedules', command.resource_id, actor.academy_id, lock);
  const after = { ...record, ...command.changes };
  return { record, instructor: await instructor(conn, record.instructor_id, actor.academy_id, lock),
    duplicates: await rows(conn, `SELECT id FROM instructor_schedules WHERE academy_id = ? AND instructor_id = ?
      AND work_date = ? AND time_slot = ? AND id <> ? ORDER BY id`, [actor.academy_id, record.instructor_id, after.work_date, after.time_slot, record.id], lock),
    attendance: await rows(conn, `SELECT id, work_date, time_slot, attendance_status FROM instructor_attendance
      WHERE instructor_id = ? AND ((work_date = ? AND time_slot = ?) OR (work_date = ? AND time_slot = ?)) ORDER BY id`,
    [record.instructor_id, record.work_date, record.time_slot, after.work_date, after.time_slot], lock) };
}
async function consultationState(conn, actor, command, lock) {
  const record = await commandRepo.row(conn, 'consultations', command.resource_id, actor.academy_id, lock);
  if (record.linked_student_id) await commandRepo.row(conn, 'students', record.linked_student_id, actor.academy_id, lock);
  const after = { ...record, ...command.changes };
  return { record,
    blocks: await rows(conn, 'SELECT * FROM consultation_blocked_slots WHERE academy_id = ? AND blocked_date = ? ORDER BY id', [actor.academy_id, after.preferred_date], lock),
    reservations: await rows(conn, `SELECT id FROM consultations WHERE academy_id = ? AND preferred_date = ? AND preferred_time = ?
      AND status <> 'cancelled' AND id <> ? ORDER BY id`, [actor.academy_id, after.preferred_date, after.preferred_time, record.id], lock),
    settings: await rows(conn, 'SELECT id, max_reservations_per_slot FROM consultation_settings WHERE academy_id = ? ORDER BY id', [actor.academy_id], lock) };
}
async function eventState(conn, actor, command, lock) {
  const record = await eventRepo.findEvent(command.resource_id, actor.academy_id, conn, lock);
  if (!record) fail(404, 'NOT_FOUND', '내 교육원에서 해당 행사를 찾을 수 없습니다.');
  const date = command.changes.event_date || record.event_date, academy = actor.academy_id;
  return { record,
    blocks: await rows(conn, `SELECT * FROM consultation_blocked_slots WHERE academy_id = ?
      AND (academy_event_id = ? OR blocked_date = ?) ORDER BY id`, [academy, record.id, date], lock),
    classes: await rows(conn, `SELECT id, class_date, time_slot, is_closed, close_reason, academy_event_id FROM class_schedules
      WHERE academy_id = ? AND (academy_event_id = ? OR class_date = ?) ORDER BY id`, [academy, record.id, date], lock),
    holidays: await rows(conn, `SELECT id FROM academy_events WHERE academy_id = ? AND event_date = ? AND is_holiday = 1 AND id <> ? ORDER BY id`, [academy, date, record.id], lock),
    reservations: await rows(conn, `SELECT id, preferred_date, preferred_time FROM consultations
      WHERE academy_id = ? AND preferred_date = ? AND status IN ('pending', 'confirmed') ORDER BY id`, [academy, date], lock) };
}
module.exports = { classState, instructorState, consultationState, eventState };
