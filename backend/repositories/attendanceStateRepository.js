const db = require('../config/database');

async function findSchedule(academyId, scheduleId) {
    const [rows] = await db.query(
        `SELECT id, class_date, time_slot, attendance_taken
         FROM class_schedules WHERE academy_id = ? AND id = ?`,
        [academyId, scheduleId]
    );
    return rows[0] || null;
}

async function findRecordedStudents(academyId, scheduleId) {
    const [rows] = await db.query(
        `SELECT a.student_id, s.name AS student_name, s.grade, a.attendance_status,
                a.notes, a.makeup_date, a.is_makeup, s.is_trial, s.trial_remaining
         FROM attendance a JOIN students s ON s.id = a.student_id AND s.academy_id = ?
         WHERE a.class_schedule_id = ? AND s.deleted_at IS NULL
         ORDER BY a.student_id`,
        [academyId, scheduleId]
    );
    return rows;
}

async function findEligibleStudents(academyId, date, timeSlot, weekday) {
    const [rows] = await db.query(
        `SELECT s.id AS student_id, s.name AS student_name, s.grade, s.is_trial, s.trial_remaining
         FROM students s
         WHERE s.academy_id = ? AND s.status = 'active' AND s.deleted_at IS NULL
           AND ((JSON_CONTAINS(s.class_days, CAST(? AS JSON)) AND s.time_slot = ?)
             OR JSON_CONTAINS(s.class_days, CAST(? AS JSON)))
           AND (s.enrollment_date IS NULL OR s.enrollment_date <= ?)
         ORDER BY s.id`,
        [academyId, JSON.stringify(weekday), timeSlot,
            JSON.stringify({ day: weekday, timeSlot }), date]
    );
    return rows;
}

module.exports = { findSchedule, findRecordedStudents, findEligibleStudents };
