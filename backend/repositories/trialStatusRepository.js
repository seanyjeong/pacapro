async function findAttendanceContextForUpdate(connection, {
    academyId,
    scheduleId,
    studentId,
}) {
    const [students] = await connection.query(
        `SELECT id, academy_id, name, status, is_trial, trial_remaining, trial_dates
           FROM students
          WHERE id = ? AND academy_id = ? AND deleted_at IS NULL
          FOR UPDATE`,
        [studentId, academyId]
    );
    if (students.length === 0) return null;

    const [attendance] = await connection.query(
        `SELECT attendance_status
           FROM attendance
          WHERE class_schedule_id = ? AND student_id = ?`,
        [scheduleId, studentId]
    );

    return {
        previousAttendanceStatus: attendance[0]?.attendance_status ?? null,
        student: students[0],
    };
}

async function findTrialStudents(connection) {
    const [students] = await connection.query(
        `SELECT id, academy_id, status, is_trial, trial_remaining, trial_dates
           FROM students
          WHERE status = 'trial'
            AND is_trial = 1
            AND trial_dates IS NOT NULL
            AND deleted_at IS NULL`
    );
    return students;
}

async function updateTrialState(connection, {
    academyId,
    isTrial,
    note = null,
    status,
    studentId,
    trialDates,
    trialRemaining,
}) {
    const [result] = await connection.query(
        `UPDATE students
            SET status = ?,
                is_trial = ?,
                trial_remaining = ?,
                trial_dates = ?,
                memo = CASE
                    WHEN ? IS NULL THEN memo
                    ELSE CONCAT_WS('\n', NULLIF(memo, ''), ?)
                END,
                updated_at = NOW()
          WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
        [
            status,
            isTrial ? 1 : 0,
            trialRemaining,
            JSON.stringify(trialDates),
            note,
            note,
            studentId,
            academyId,
        ]
    );
    if (result.affectedRows !== 1) {
        throw new Error('Trial state update did not affect exactly one student.');
    }
}

module.exports = {
    findAttendanceContextForUpdate,
    findTrialStudents,
    updateTrialState,
};
