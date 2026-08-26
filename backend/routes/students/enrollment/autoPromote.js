const pool = require('../../../config/database');
const { verifyToken, requireRole } = require('../../../middleware/auth');
const logger = require('../../../utils/logger');
const {
    getPromotedStudentValues,
} = require('../../../services/studentGradePromotionService');

function addAdmissionTransition(detail, student, promotedValues) {
    if (!promotedValues.admissionTypeChanged) return detail;

    return {
        ...detail,
        admissionTypeFrom: student.admission_type,
        admissionTypeTo: promotedValues.admissionType,
    };
}

module.exports = function registerAutoPromoteRoute(router) {
    router.post('/auto-promote', verifyToken, requireRole('owner'), async (req, res) => {
        try {
            const { dry_run = false, graduate_student_ids = [] } = req.body;
            const academyId = req.user.academyId;

            const [students] = await pool.execute(`
                SELECT id, name, grade, status, admission_type
                FROM students
                WHERE academy_id = ?
                  AND deleted_at IS NULL
                  AND status IN ('active', 'paused')
                  AND grade IS NOT NULL
                ORDER BY grade
            `, [academyId]);

            if (students.length === 0) {
                return res.json({
                    message: '진급 대상 학생이 없습니다',
                    promoted: 0,
                    graduated: 0,
                    details: []
                });
            }

            const promotionDetails = [];
            let promotedCount = 0;
            let graduatedCount = 0;

            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                for (const student of students) {
                    const promotedValues = getPromotedStudentValues(student);
                    const shouldGraduate = student.grade === '고3'
                        && graduate_student_ids.includes(student.id);

                    if (shouldGraduate) {
                        if (!dry_run) {
                            await connection.execute(
                                "UPDATE students SET status = 'graduated', updated_at = NOW() WHERE id = ?",
                                [student.id]
                            );

                            const today = new Date().toISOString().split('T')[0];
                            await connection.execute(
                                `DELETE a FROM attendance a
                                 JOIN class_schedules cs ON a.class_schedule_id = cs.id
                                 WHERE a.student_id = ?
                                 AND cs.academy_id = ?
                                 AND cs.class_date >= ?
                                 AND (a.attendance_status IS NULL OR a.attendance_status = 'absent')`,
                                [student.id, academyId, today]
                            );
                        }
                        promotionDetails.push({
                            studentId: student.id,
                            name: student.name,
                            from: student.grade,
                            to: '졸업',
                            action: 'graduated'
                        });
                        graduatedCount++;
                    } else if (promotedValues.grade && student.grade !== promotedValues.grade) {
                        if (!dry_run) {
                            if (promotedValues.admissionTypeChanged) {
                                await connection.execute(
                                    `UPDATE students
                                     SET grade = ?, admission_type = ?, updated_at = NOW()
                                     WHERE id = ?`,
                                    [promotedValues.grade, promotedValues.admissionType, student.id]
                                );
                            } else {
                                await connection.execute(
                                    'UPDATE students SET grade = ?, updated_at = NOW() WHERE id = ?',
                                    [promotedValues.grade, student.id]
                                );
                            }
                        }
                        promotionDetails.push(addAdmissionTransition({
                            studentId: student.id,
                            name: student.name,
                            from: student.grade,
                            to: promotedValues.grade,
                            action: 'promoted'
                        }, student, promotedValues));
                        promotedCount++;
                    }
                }

                if (!dry_run) {
                    await connection.commit();
                } else {
                    await connection.rollback();
                }
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

            const summary = {};
            promotionDetails.forEach((detail) => {
                const key = `${detail.from} → ${detail.to}`;
                summary[key] = (summary[key] || 0) + 1;
            });

            res.json({
                message: dry_run
                    ? `진급 미리보기: ${promotedCount}명 진급, ${graduatedCount}명 졸업 예정`
                    : `진급 완료: ${promotedCount}명 진급, ${graduatedCount}명 졸업 처리`,
                dry_run,
                promoted: promotedCount,
                graduated: graduatedCount,
                summary,
                details: promotionDetails
            });
        } catch (error) {
            logger.error('Auto-promote error:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '학년 자동 진급 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
            });
        }
    });
};
