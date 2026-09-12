const db = require('../config/database');

async function findInstructors(academyId) {
    const [rows] = await db.query(
        `SELECT id, name FROM instructors
         WHERE academy_id = ? AND status = 'active' AND deleted_at IS NULL`,
        [academyId]
    );
    return rows;
}

async function findSchedules(academyId, startDate, endDate) {
    const [rows] = await db.query(
        `SELECT s.id, s.instructor_id, i.name AS instructor_name, s.work_date,
                s.time_slot, s.scheduled_start_time, s.scheduled_end_time
         FROM instructor_schedules s
         JOIN instructors i ON i.id = s.instructor_id AND i.academy_id = s.academy_id
         WHERE s.academy_id = ? AND i.deleted_at IS NULL
           AND s.work_date >= ? AND s.work_date < ?
         ORDER BY s.work_date, s.id`,
        [academyId, startDate, endDate]
    );
    return rows;
}

module.exports = { findInstructors, findSchedules };
