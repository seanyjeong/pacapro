const db = require('../config/database');

async function findInstructor(academyId, instructorId) {
    const [rows] = await db.query(
        `SELECT id
           FROM instructors
          WHERE id = ?
            AND academy_id = ?
            AND deleted_at IS NULL`,
        [instructorId, academyId]
    );
    return rows[0] || null;
}

async function findMonthlySchedules(academyId, instructorId, yearMonth) {
    const [rows] = await db.query(
        `SELECT id, work_date, time_slot, scheduled_start_time, scheduled_end_time
           FROM instructor_schedules
          WHERE academy_id = ?
            AND instructor_id = ?
            AND DATE_FORMAT(work_date, '%Y-%m') = ?
          ORDER BY work_date, FIELD(time_slot, 'morning', 'afternoon', 'evening')`,
        [academyId, instructorId, yearMonth]
    );
    return rows;
}

module.exports = {
    findInstructor,
    findMonthlySchedules,
};
