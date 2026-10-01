const db = require('../config/database');

async function graduateDueStudents(dateText) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [due] = await connection.query(
            `SELECT ss.id AS enrollment_id, s.id AS student_id
             FROM students s
             JOIN student_seasons ss ON ss.student_id = s.id
             JOIN seasons se ON se.id = ss.season_id AND se.academy_id = s.academy_id
             WHERE s.status IN ('active', 'paused')
               AND s.deleted_at IS NULL
               AND (s.current_season_id IS NULL OR s.current_season_id = se.id)
               AND COALESCE(ss.is_cancelled, 0) = 0
               AND ss.payment_status != 'cancelled'
               AND ss.aftercare_applied_at IS NULL
               AND se.post_free_action = 'graduate'
               AND se.free_lesson_end_date < ?
               AND se.season_end_date <= se.free_lesson_end_date
               AND NOT EXISTS (
                   SELECT 1 FROM student_seasons later
                   JOIN seasons next_se ON next_se.id = later.season_id
                   WHERE later.student_id = s.id
                     AND next_se.academy_id = s.academy_id
                     AND next_se.id != se.id
                     AND next_se.season_start_date > se.season_start_date
                     AND next_se.season_end_date >= ?
                     AND COALESCE(later.is_cancelled, 0) = 0
                     AND later.payment_status != 'cancelled'
               )
             FOR UPDATE`,
            [dateText, dateText]
        );

        if (due.length === 0) {
            await connection.commit();
            return 0;
        }

        const studentIds = [...new Set(due.map((row) => row.student_id))];
        const enrollmentIds = due.map((row) => row.enrollment_id);
        const studentMarks = studentIds.map(() => '?').join(',');
        const enrollmentMarks = enrollmentIds.map(() => '?').join(',');
        const [students] = await connection.query(
            `UPDATE students
             SET status = 'graduated', current_season_id = NULL,
                 is_season_registered = 0, updated_at = NOW()
             WHERE id IN (${studentMarks}) AND status IN ('active', 'paused')`,
            studentIds
        );
        if (students.affectedRows !== studentIds.length) throw new Error('졸업 학생 수가 예상과 다릅니다.');

        const [enrollments] = await connection.query(
            `UPDATE student_seasons SET aftercare_applied_at = NOW()
             WHERE id IN (${enrollmentMarks}) AND aftercare_applied_at IS NULL`,
            enrollmentIds
        );
        if (enrollments.affectedRows !== enrollmentIds.length) throw new Error('시즌 졸업 기록 수가 예상과 다릅니다.');

        await connection.commit();
        return studentIds.length;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { graduateDueStudents };
