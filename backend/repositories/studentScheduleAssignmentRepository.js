// Preserve existing schedules and checked attendance on the caller's transaction.
async function assign(connection, academyId, studentId, target) {
    const [schedules] = await connection.query(
        `SELECT id FROM class_schedules
         WHERE academy_id = ? AND class_date = ? AND time_slot = ? ORDER BY id`,
        [academyId, target.date, target.time_slot]
    );
    let scheduleId = schedules[0]?.id;
    const created = !schedules.length;
    if (created) {
        const [result] = await connection.query(
            `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
             VALUES (?, ?, ?, false)`, [academyId, target.date, target.time_slot]
        );
        scheduleId = result.insertId;
    }
    const [existing] = await connection.query(
        'SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?',
        [scheduleId, studentId]
    );
    const assigned = !existing.length;
    if (assigned) await connection.query(
        `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
         VALUES (?, ?, NULL)`, [scheduleId, studentId]
    );
    return { created: Number(created), assigned: Number(assigned) };
}
module.exports = { assign };
