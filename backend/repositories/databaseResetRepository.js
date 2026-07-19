const db = require('../config/database');

const ACADEMY_DELETE_QUERIES = [
    ['expenses', 'DELETE FROM expenses WHERE academy_id = ?'],
    ['other_incomes', 'DELETE FROM other_incomes WHERE academy_id = ?'],
    ['revenues', 'DELETE FROM revenues WHERE academy_id = ?'],
    [
        'instructor_attendance',
        `DELETE ia FROM instructor_attendance ia
         JOIN instructors i ON i.id = ia.instructor_id
         WHERE i.academy_id = ?`,
    ],
    [
        'salary_records',
        `DELETE sr FROM salary_records sr
         JOIN instructors i ON i.id = sr.instructor_id
         WHERE i.academy_id = ?`,
    ],
    [
        'student_seasons',
        `DELETE ss FROM student_seasons ss
         JOIN students s ON s.id = ss.student_id
         WHERE s.academy_id = ?`,
    ],
    ['student_payments', 'DELETE FROM student_payments WHERE academy_id = ?'],
    ['instructor_schedules', 'DELETE FROM instructor_schedules WHERE academy_id = ?'],
    ['overtime_approvals', 'DELETE FROM overtime_approvals WHERE academy_id = ?'],
    ['class_schedules', 'DELETE FROM class_schedules WHERE academy_id = ?'],
    ['students', 'DELETE FROM students WHERE academy_id = ?'],
    ['instructors', 'DELETE FROM instructors WHERE academy_id = ?'],
    ['seasons', 'DELETE FROM seasons WHERE academy_id = ?'],
];

async function resetAcademyData(academyId, database = db) {
    const connection = await database.getConnection();

    try {
        await connection.beginTransaction();
        const results = {};

        for (const [table, sql] of ACADEMY_DELETE_QUERIES) {
            const [result] = await connection.execute(sql, [academyId]);
            results[table] = result.affectedRows;
        }

        await connection.commit();
        return {
            deletedRows: Object.values(results).reduce((sum, count) => sum + count, 0),
            tables: results,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { resetAcademyData };
