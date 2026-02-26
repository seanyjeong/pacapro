const db = require('../../config/database');
const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');

module.exports = function(router) {

/**
 * GET /paca/students/rest-ended
 * 휴원 종료일이 지난 학생 목록 조회 (복귀 대기)
 * Access: owner, admin, staff
 */
router.get('/rest-ended', verifyToken, requireRole('owner', 'admin', 'staff'), async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const today = new Date().toISOString().split('T')[0];

        const [students] = await db.query(
            `SELECT
                id, name, phone, school, grade,
                rest_start_date, rest_end_date, rest_reason,
                class_days, time_slot, monthly_tuition, discount_rate
             FROM students
             WHERE academy_id = ?
             AND deleted_at IS NULL
             AND status = 'paused'
             AND rest_end_date IS NOT NULL
             AND rest_end_date < ?
             ORDER BY rest_end_date ASC`,
            [academyId, today]
        );

        // 이름, 전화번호 복호화 및 경과일 계산
        const decryptedStudents = students.map(s => {
            const restEndDate = new Date(s.rest_end_date);
            const todayDate = new Date(today);
            const daysOverdue = Math.floor((todayDate - restEndDate) / (1000 * 60 * 60 * 24));

            return {
                ...s,
                name: decrypt(s.name),
                phone: s.phone ? decrypt(s.phone) : null,
                days_overdue: daysOverdue
            };
        });

        res.json({
            message: 'Success',
            students: decryptedStudents
        });
    } catch (error) {
        logger.error('Error fetching rest-ended students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch rest-ended students'
        });
    }
});

/**
 * POST /paca/students/:id/withdraw
 * 퇴원 처리
 * Access: owner, admin
 */
router.post('/:id/withdraw', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { reason, withdrawal_date } = req.body;

    try {
        // Check if student exists
        const [students] = await db.query(
            'SELECT id, name, status FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        if (students[0].status === 'withdrawn') {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이미 퇴원 처리된 학생입니다'
            });
        }

        // 퇴원 처리
        await db.query(
            `UPDATE students
             SET status = 'withdrawn',
                 withdrawal_date = ?,
                 withdrawal_reason = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [withdrawal_date || new Date().toISOString().split('T')[0], reason || null, studentId]
        );

        // 미래 스케줄에서 제거 (오늘 이후)
        const today = new Date().toISOString().split('T')[0];
        await db.query(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ? AND cs.class_date > ? AND a.attendance_status IS NULL`,
            [studentId, today]
        );

        res.json({
            message: '퇴원 처리되었습니다',
            student: {
                id: studentId,
                name: students[0].name,
                status: 'withdrawn',
                withdrawal_date: withdrawal_date || today,
                withdrawal_reason: reason
            }
        });
    } catch (error) {
        logger.error('Error withdrawing student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to withdraw student'
        });
    }
});

/**
 * POST /paca/students/grade-upgrade
 * Bulk upgrade student grades (진급 처리)
 * Access: owner, admin
 */
router.post('/grade-upgrade', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    try {
        const { upgrades } = req.body;

        if (!Array.isArray(upgrades) || upgrades.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'upgrades must be a non-empty array'
            });
        }

        const validGrades = ['고1', '고2', '고3', 'N수', null];
        const validStatuses = ['active', 'inactive', 'graduated'];

        // Validate all upgrades first
        for (const upgrade of upgrades) {
            if (!upgrade.student_id) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Each upgrade must have student_id'
                });
            }

            if (upgrade.new_grade !== null && upgrade.new_grade !== undefined && !validGrades.includes(upgrade.new_grade)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `Invalid grade: ${upgrade.new_grade}. Must be one of: 고1, 고2, 고3, N수`
                });
            }

            if (upgrade.new_status && !validStatuses.includes(upgrade.new_status)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `Invalid status: ${upgrade.new_status}. Must be one of: active, inactive, graduated`
                });
            }
        }

        // Verify all students belong to this academy
        const studentIds = upgrades.map(u => u.student_id);
        const [existingStudents] = await db.query(
            `SELECT id FROM students
             WHERE id IN (?)
             AND academy_id = ?
             AND deleted_at IS NULL`,
            [studentIds, req.user.academyId]
        );

        if (existingStudents.length !== studentIds.length) {
            const foundIds = existingStudents.map(s => s.id);
            const missingIds = studentIds.filter(id => !foundIds.includes(id));
            return res.status(400).json({
                error: 'Validation Error',
                message: `Students not found: ${missingIds.join(', ')}`
            });
        }

        // Perform updates in transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            let updatedCount = 0;

            for (const upgrade of upgrades) {
                const updates = [];
                const params = [];

                if (upgrade.new_grade !== undefined) {
                    updates.push('grade = ?');
                    params.push(upgrade.new_grade);
                }

                if (upgrade.new_status) {
                    updates.push('status = ?');
                    params.push(upgrade.new_status);
                }

                if (updates.length > 0) {
                    updates.push('updated_at = NOW()');
                    params.push(upgrade.student_id);

                    await connection.query(
                        `UPDATE students SET ${updates.join(', ')} WHERE id = ?`,
                        params
                    );
                    updatedCount++;
                }
            }

            await connection.commit();

            res.json({
                message: `Successfully upgraded ${updatedCount} students`,
                updated_count: updatedCount
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        logger.error('Error upgrading student grades:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to upgrade student grades'
        });
    }
});

/**
 * POST /paca/students/auto-promote
 * 학년 자동 진급 (3월 신학기)
 * Access: owner only
 *
 * 진급 규칙:
 * - 중1 → 중2, 중2 → 중3, 중3 → 고1
 * - 고1 → 고2, 고2 → 고3, 고3 → N수
 * - N수 → N수 (유지)
 *
 * Body (선택):
 * - dry_run: true면 실제 변경 없이 미리보기만
 * - graduate_student_ids: 고3 중 졸업 처리할 학생 ID 배열 (status를 'graduated'로 변경)
 */
router.post('/auto-promote', verifyToken, requireRole('owner'), async (req, res) => {
    try {
        const { dry_run = false, graduate_student_ids = [] } = req.body;
        const academyId = req.user.academyId;

        // 학년 진급 매핑
        const GRADE_PROMOTION_MAP = {
            '중1': '중2',
            '중2': '중3',
            '중3': '고1',
            '고1': '고2',
            '고2': '고3',
            '고3': 'N수',
            'N수': 'N수'
        };

        // 해당 학원의 active/paused 학생 조회 (graduated 제외)
        const [students] = await db.query(`
            SELECT id, name, grade, status
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

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            for (const student of students) {
                const currentGrade = student.grade;
                const newGrade = GRADE_PROMOTION_MAP[currentGrade];

                // 졸업 처리 대상인지 확인 (고3 학생 중)
                const shouldGraduate = currentGrade === '고3' &&
                    graduate_student_ids.includes(student.id);

                if (shouldGraduate) {
                    // 졸업 처리
                    if (!dry_run) {
                        await connection.query(
                            `UPDATE students SET status = 'graduated', updated_at = NOW() WHERE id = ?`,
                            [student.id]
                        );

                        // 졸업생 미래 스케줄 삭제
                        const today = new Date().toISOString().split('T')[0];
                        await connection.query(
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
                        from: currentGrade,
                        to: '졸업',
                        action: 'graduated'
                    });
                    graduatedCount++;
                } else if (newGrade && currentGrade !== newGrade) {
                    // 진급 처리
                    if (!dry_run) {
                        await connection.query(
                            `UPDATE students SET grade = ?, updated_at = NOW() WHERE id = ?`,
                            [newGrade, student.id]
                        );
                    }
                    promotionDetails.push({
                        studentId: student.id,
                        name: student.name,
                        from: currentGrade,
                        to: newGrade,
                        action: 'promoted'
                    });
                    promotedCount++;
                }
            }

            if (!dry_run) {
                await connection.commit();
            } else {
                await connection.rollback();
            }
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        // 진급 요약
        const summary = {};
        promotionDetails.forEach(d => {
            const key = `${d.from} → ${d.to}`;
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
            message: 'Failed to auto-promote students'
        });
    }
});

/**
 * GET /paca/students/:id/seasons
 * Get student's season enrollment history
 * Access: owner, admin, teacher
 */
router.get('/:id/seasons', verifyToken, async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // Verify student exists and belongs to academy
        const [students] = await db.query(
            'SELECT id, name FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        // Get season enrollment history
        const [seasons] = await db.query(
            `SELECT
                ss.id as enrollment_id,
                ss.season_id,
                ss.season_fee,
                ss.registration_date,
                ss.after_season_action,
                ss.prorated_month,
                ss.prorated_amount,
                ss.prorated_details,
                ss.is_continuous,
                ss.previous_season_id,
                ss.discount_type,
                ss.discount_amount,
                ss.payment_status,
                ss.paid_date,
                ss.paid_amount,
                ss.payment_method,
                ss.is_cancelled,
                ss.cancellation_date,
                ss.refund_amount,
                ss.time_slots,
                ss.created_at,
                s.season_name,
                s.season_type,
                s.season_start_date,
                s.season_end_date,
                s.non_season_end_date,
                s.status as season_status,
                s.operating_days,
                s.grade_time_slots
            FROM student_seasons ss
            JOIN seasons s ON ss.season_id = s.id
            WHERE ss.student_id = ?
            ORDER BY ss.registration_date DESC`,
            [studentId]
        );

        res.json({
            message: `Found ${seasons.length} season enrollments`,
            student: students[0],
            seasons
        });
    } catch (error) {
        logger.error('Error fetching student seasons:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch student seasons'
        });
    }
});

};
