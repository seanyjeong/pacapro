const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole, checkPermission } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const {
    calculateProRatedFee,
    calculateSeasonRefund,
    calculateMidSeasonFee,
    parseWeeklyDays,
    previewSeasonTransition,
    truncateToThousands
} = require('../utils/seasonCalculator');

// ============================================================
// 시즌 스케줄 자동 배치 함수들
// ============================================================

/**
 * 학생을 시즌 스케줄에 자동 배정
 * @param {number} studentId - 학생 ID
 * @param {number} academyId - 학원 ID
 * @param {object} season - 시즌 정보
 * @param {string} studentGrade - 학생 학년 (예: "고3", "중2", "N수")
 * @param {string} studentType - 학생 유형 (early/regular)
 * @param {string[]} customTimeSlots - 사용자 지정 시간대 배열 (선택사항, 고3/N수용)
 */
async function autoAssignStudentToSeasonSchedules(studentId, academyId, season, studentGrade, studentType, customTimeSlots = null, registrationDate = null) {
    try {
        const operatingDays = typeof season.operating_days === 'string'
            ? JSON.parse(season.operating_days)
            : season.operating_days;

        const gradeTimeSlots = season.grade_time_slots
            ? (typeof season.grade_time_slots === 'string'
                ? JSON.parse(season.grade_time_slots)
                : season.grade_time_slots)
            : null;

        // 시간대 결정: customTimeSlots가 있으면 사용, 없으면 기본 로직
        let timeSlots = [];

        if (customTimeSlots && Array.isArray(customTimeSlots) && customTimeSlots.length > 0) {
            // 사용자가 지정한 시간대 사용 (고3/N수 여러 시간대 지원)
            timeSlots = customTimeSlots;
        } else if (gradeTimeSlots) {
            // grade_time_slots 설정에서 시간대 결정
            if (gradeTimeSlots[studentGrade]) {
                const slot = gradeTimeSlots[studentGrade];
                timeSlots = Array.isArray(slot) ? slot : [slot];
            } else if (gradeTimeSlots[studentType]) {
                const slot = gradeTimeSlots[studentType];
                timeSlots = Array.isArray(slot) ? slot : [slot];
            } else {
                timeSlots = ['evening'];
            }
        } else {
            timeSlots = ['evening'];
        }

        // 요일 변환 (문자열 -> 숫자)
        const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
        const numericDays = operatingDays.map(d => typeof d === 'string' ? dayMap[d] : d).filter(d => d !== undefined);

        if (numericDays.length === 0) {
            logger.info('No operating days specified for season, skipping auto-assignment');
            return { assigned: 0, created: 0, timeSlots: [] };
        }

        const seasonStartDate = new Date(season.season_start_date + 'T00:00:00');
        const endDate = new Date(season.season_end_date + 'T00:00:00');

        // 등록일이 있으면 등록일과 시즌 시작일 중 늦은 날짜부터 배정
        // 등록일이 없으면 시즌 시작일부터 배정
        let startDate = seasonStartDate;
        if (registrationDate) {
            const regDate = new Date(registrationDate + 'T00:00:00');
            if (regDate > seasonStartDate) {
                startDate = regDate;
                logger.info(`Mid-season enrollment: starting from registration date ${registrationDate} instead of season start ${season.season_start_date}`);
            }
        }

        let assignedCount = 0;
        let createdCount = 0;

        // 시작일(등록일 또는 시즌시작일)부터 종료일까지 운영 요일에 배정
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();

            if (numericDays.includes(dayOfWeek)) {
                const dateStr = currentDate.toISOString().split('T')[0];

                // 각 시간대에 대해 스케줄 배정
                for (const timeSlot of timeSlots) {
                    // 해당 날짜+시간대의 스케줄 조회 또는 생성
                    let [schedules] = await db.query(
                        `SELECT id FROM class_schedules
                         WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                        [academyId, dateStr, timeSlot]
                    );

                    let scheduleId;
                    if (schedules.length === 0) {
                        // 스케줄 생성
                        const [result] = await db.query(
                            `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                             VALUES (?, ?, ?, false)`,
                            [academyId, dateStr, timeSlot]
                        );
                        scheduleId = result.insertId;
                        createdCount++;
                    } else {
                        scheduleId = schedules[0].id;
                    }

                    // 이미 배정되어 있는지 확인
                    const [existing] = await db.query(
                        `SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?`,
                        [scheduleId, studentId]
                    );

                    if (existing.length === 0) {
                        // 출석 기록 생성 (배정)
                        await db.query(
                            `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                             VALUES (?, ?, NULL)`,
                            [scheduleId, studentId]
                        );
                        assignedCount++;
                    }
                }
            }

            // 다음 날로 이동
            currentDate.setDate(currentDate.getDate() + 1);
        }

        logger.info(`Season auto-assigned student ${studentId}: ${assignedCount} schedules (${createdCount} new), timeSlots: ${timeSlots.join(', ')}`);
        return { assigned: assignedCount, created: createdCount, timeSlots };
    } catch (error) {
        logger.error('Error in autoAssignStudentToSeasonSchedules:', error);
        throw error;
    }
}

/**
 * 기존 정규 스케줄에서 학생 제거 (시즌 기간 동안만)
 * @param {number} studentId - 학생 ID
 * @param {number} academyId - 학원 ID
 * @param {string} seasonStartDate - 시즌 시작일 (YYYY-MM-DD)
 * @param {string} seasonEndDate - 시즌 종료일 (YYYY-MM-DD)
 */
async function removeStudentFromRegularSchedules(studentId, academyId, seasonStartDate, seasonEndDate) {
    try {
        // 시즌 기간 동안의 기존 출석 기록 삭제 (아직 출석 처리 안된 것만)
        const [result] = await db.query(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
             AND cs.academy_id = ?
             AND cs.class_date >= ?
             AND cs.class_date <= ?
             AND a.attendance_status IS NULL`,
            [studentId, academyId, seasonStartDate, seasonEndDate]
        );

        logger.info(`Removed ${result.affectedRows} regular schedule assignments for student ${studentId} during season period`);
        return { removed: result.affectedRows };
    } catch (error) {
        logger.error('Error in removeStudentFromRegularSchedules:', error);
        throw error;
    }
}

/**
 * 시즌에 등록된 모든 학생을 스케줄에 자동 배정
 * @param {number} seasonId - 시즌 ID
 * @param {number} academyId - 학원 ID
 */
async function autoAssignAllSeasonStudentsToSchedules(seasonId, academyId) {
    try {
        // 시즌 정보 조회
        const [seasons] = await db.query(
            'SELECT * FROM seasons WHERE id = ? AND academy_id = ?',
            [seasonId, academyId]
        );

        if (seasons.length === 0) {
            logger.info(`Season ${seasonId} not found`);
            return { totalAssigned: 0, totalCreated: 0, studentsProcessed: 0 };
        }

        const season = seasons[0];

        // 해당 시즌에 등록된 학생 조회 (취소되지 않은 학생만)
        const [enrollments] = await db.query(
            `SELECT ss.*, s.grade, s.student_type
             FROM student_seasons ss
             JOIN students s ON ss.student_id = s.id
             WHERE ss.season_id = ?
             AND ss.is_cancelled = 0
             AND s.deleted_at IS NULL`,
            [seasonId]
        );

        let totalAssigned = 0;
        let totalCreated = 0;

        for (const enrollment of enrollments) {
            try {
                const result = await autoAssignStudentToSeasonSchedules(
                    enrollment.student_id,
                    academyId,
                    season,
                    enrollment.grade,
                    enrollment.student_type
                );
                totalAssigned += result.assigned;
                totalCreated += result.created;
            } catch (err) {
                logger.error(`Failed to assign student ${enrollment.student_id}:`, err);
            }
        }

        logger.info(`Season ${seasonId} auto-assigned: ${enrollments.length} students, ${totalAssigned} schedules (${totalCreated} new)`);
        return { totalAssigned, totalCreated, studentsProcessed: enrollments.length };
    } catch (error) {
        logger.error('Error in autoAssignAllSeasonStudentsToSchedules:', error);
        throw error;
    }
}

// ============================================================
// API 라우트
// ============================================================

/**
 * GET /paca/seasons
 * Get all seasons for academy
 * Access: owner, admin, teacher
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { status, season_type } = req.query;

        // 종료일 지난 active 시즌 자동 ended 처리
        await db.query(
            `UPDATE seasons SET status = 'ended' WHERE academy_id = ? AND status = 'active' AND season_end_date < CURDATE()`,
            [req.user.academyId]
        );

        let query = `
            SELECT * FROM seasons
            WHERE academy_id = ?
        `;
        const params = [req.user.academyId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        if (season_type) {
            query += ' AND season_type = ?';
            params.push(season_type);
        }

        query += ' ORDER BY season_start_date DESC';

        const [seasons] = await db.query(query, params);

        res.json({
            message: `Found ${seasons.length} seasons`,
            seasons
        });
    } catch (error) {
        logger.error('Error fetching seasons:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch seasons'
        });
    }
});

/**
 * GET /paca/seasons/active
 * Get currently active season(s)
 * Access: owner, admin, teacher
 * NOTE: 이 라우트는 /:id 보다 먼저 정의되어야 함
 */
router.get('/active', verifyToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const [seasons] = await db.query(
            `SELECT * FROM seasons
            WHERE academy_id = ?
            AND status = 'active'
            AND season_start_date <= ?
            AND season_end_date >= ?
            ORDER BY season_type`,
            [req.user.academyId, today, today]
        );

        res.json({
            message: `Found ${seasons.length} active season(s)`,
            seasons
        });
    } catch (error) {
        logger.error('Error fetching active seasons:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch active seasons'
        });
    }
});

/**
 * POST /paca/seasons/enrollments/:enrollment_id/pay
 * Record season fee payment
 * Access: owner, admin
 * NOTE: 이 라우트는 /:id 보다 먼저 정의되어야 함
 */
router.post('/enrollments/:enrollment_id/pay', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const enrollmentId = parseInt(req.params.enrollment_id);

    try {
        const { paid_date, paid_amount, payment_method } = req.body;

        // Get enrollment
        const [enrollments] = await db.query(
            `SELECT
                ss.*,
                s.academy_id,
                s.name as student_name,
                se.season_name
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (enrollments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Enrollment not found'
            });
        }

        const enrollment = enrollments[0];

        if (enrollment.academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }

        if (enrollment.payment_status === 'paid') {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Season fee already paid'
            });
        }

        // Update payment status
        const paymentDate = paid_date || new Date().toISOString().split('T')[0];
        const paymentAmount = paid_amount || enrollment.season_fee;

        await db.query(
            `UPDATE student_seasons
            SET payment_status = 'paid', paid_date = ?, paid_amount = ?, payment_method = ?, updated_at = NOW()
            WHERE id = ?`,
            [paymentDate, paymentAmount, payment_method || null, enrollmentId]
        );

        // Record in revenues table
        await db.query(
            `INSERT INTO revenues (
                academy_id,
                category,
                amount,
                revenue_date,
                student_id,
                description
            ) VALUES (?, 'season', ?, ?, ?, ?)`,
            [
                enrollment.academy_id,
                paymentAmount,
                paymentDate,
                enrollment.student_id,
                `시즌비 납부 (${enrollment.season_name})`
            ]
        );

        // Get updated record
        const [updated] = await db.query(
            `SELECT
                ss.*,
                s.name as student_name,
                se.season_name
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        // 학생 이름 복호화
        if (updated[0]) {
            updated[0].student_name = decrypt(updated[0].student_name);
        }

        res.json({
            message: 'Season fee payment recorded successfully',
            enrollment: updated[0]
        });
    } catch (error) {
        logger.error('Error recording season payment:', error);
        logger.error('Enrollment ID:', enrollmentId);
        logger.error('Request body:', req.body);
        res.status(500).json({
            error: 'Server Error',
            message: error.message || 'Failed to record payment',
            details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
        });
    }
});

/**
 * PUT /paca/seasons/enrollments/:enrollment_id
 * Update season enrollment (registration date, season fee, discount)
 * Access: owner, admin
 * NOTE: 이 라우트는 /:id 보다 먼저 정의되어야 함
 */
router.put('/enrollments/:enrollment_id', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const enrollmentId = parseInt(req.params.enrollment_id);

    try {
        const { registration_date, season_fee, discount_amount, discount_reason, time_slots } = req.body;

        // Get enrollment
        const [enrollments] = await db.query(
            `SELECT
                ss.*,
                s.academy_id,
                s.name as student_name,
                se.season_name
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (enrollments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Enrollment not found'
            });
        }

        const enrollment = enrollments[0];

        if (enrollment.academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (registration_date !== undefined) {
            updates.push('registration_date = ?');
            params.push(registration_date);
        }

        if (season_fee !== undefined) {
            updates.push('season_fee = ?');
            params.push(season_fee);
        }

        if (discount_amount !== undefined) {
            updates.push('discount_amount = ?');
            params.push(discount_amount);
        }

        if (discount_reason !== undefined) {
            updates.push('discount_type = ?');
            params.push(discount_reason ? 'custom' : 'none');
        }

        if (time_slots !== undefined) {
            updates.push('time_slots = ?');
            params.push(JSON.stringify(time_slots));
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'No fields to update'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(enrollmentId);

        await db.query(
            `UPDATE student_seasons SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        // Get updated record
        const [updated] = await db.query(
            `SELECT
                ss.*,
                s.name as student_name,
                se.season_name
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        // 학생 이름 복호화
        if (updated[0]) {
            updated[0].student_name = decrypt(updated[0].student_name);
        }

        res.json({
            message: 'Season enrollment updated successfully',
            enrollment: updated[0]
        });
    } catch (error) {
        logger.error('Error updating enrollment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: error.message || 'Failed to update enrollment'
        });
    }
});

/**
 * POST /paca/seasons/enrollments/:enrollment_id/refund-preview
 * 환불 미리보기 - 실제 취소 전 환불금 계산
 * Access: owner, admin
 */
router.post('/enrollments/:enrollment_id/refund-preview', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const enrollmentId = parseInt(req.params.enrollment_id);

    try {
        const { cancellation_date, include_vat = false } = req.body;

        // Get enrollment with payment info
        const [enrollments] = await db.query(
            `SELECT
                ss.*,
                s.academy_id,
                s.name as student_name,
                s.class_days,
                se.season_name,
                se.season_start_date,
                se.season_end_date,
                se.operating_days,
                se.default_season_fee
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (enrollments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Enrollment not found'
            });
        }

        const enrollment = enrollments[0];
        // 학생 이름 복호화
        enrollment.student_name = decrypt(enrollment.student_name);

        if (enrollment.academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }

        const cancelDate = cancellation_date || new Date().toISOString().split('T')[0];

        // 시즌 운영 요일 사용 (없으면 학생 수업요일)
        let weeklyDays = [];
        if (enrollment.operating_days) {
            weeklyDays = typeof enrollment.operating_days === 'string'
                ? JSON.parse(enrollment.operating_days)
                : enrollment.operating_days;
        } else {
            weeklyDays = parseWeeklyDays(enrollment.class_days);
        }

        // 실제 납부 금액 계산 (시즌비 - 할인)
        const originalFee = parseFloat(enrollment.season_fee) || 0;
        const discountAmount = parseFloat(enrollment.discount_amount) || 0;
        const paidAmount = originalFee - discountAmount;

        // Calculate refund with new logic
        const refundResult = calculateSeasonRefund({
            paidAmount: paidAmount,
            originalFee: originalFee,
            seasonStartDate: new Date(enrollment.season_start_date),
            seasonEndDate: new Date(enrollment.season_end_date),
            cancellationDate: new Date(cancelDate),
            weeklyDays,
            includeVat: include_vat
        });

        // 학원 정보 조회 (명세서용)
        const [academySettings] = await db.query(
            `SELECT academy_name, phone, address FROM academy_settings WHERE academy_id = ?`,
            [req.user.academyId]
        );

        res.json({
            enrollment: {
                id: enrollment.id,
                student_name: enrollment.student_name,
                season_name: enrollment.season_name,
                season_start_date: enrollment.season_start_date,
                season_end_date: enrollment.season_end_date,
                original_fee: originalFee,
                discount_amount: discountAmount,
                paid_amount: paidAmount,
                payment_status: enrollment.payment_status
            },
            cancellation_date: cancelDate,
            refund: refundResult,
            academy: academySettings[0] || {}
        });
    } catch (error) {
        logger.error('Error calculating refund preview:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to calculate refund'
        });
    }
});

/**
 * POST /paca/seasons/enrollments/:enrollment_id/cancel
 * Cancel season enrollment (refund calculation)
 * Access: owner, admin
 * NOTE: 이 라우트는 /:id 보다 먼저 정의되어야 함
 */
router.post('/enrollments/:enrollment_id/cancel', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const enrollmentId = parseInt(req.params.enrollment_id);

    try {
        const { cancellation_date, include_vat = false, final_refund_amount } = req.body;

        // Get enrollment
        const [enrollments] = await db.query(
            `SELECT
                ss.*,
                s.academy_id,
                s.name as student_name,
                s.class_days,
                se.season_name,
                se.season_start_date,
                se.season_end_date
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (enrollments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Enrollment not found'
            });
        }

        const enrollment = enrollments[0];

        if (enrollment.academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }

        // 학생 이름 복호화
        enrollment.student_name = decrypt(enrollment.student_name);

        if (enrollment.payment_status === 'cancelled') {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Enrollment already cancelled'
            });
        }

        const cancelDate = cancellation_date || new Date().toISOString().split('T')[0];

        // 시즌 운영 요일 가져오기
        const [seasonInfo] = await db.query(
            `SELECT operating_days FROM seasons WHERE id = ?`,
            [enrollment.season_id]
        );
        let weeklyDays = [];
        if (seasonInfo[0]?.operating_days) {
            weeklyDays = typeof seasonInfo[0].operating_days === 'string'
                ? JSON.parse(seasonInfo[0].operating_days)
                : seasonInfo[0].operating_days;
        } else {
            weeklyDays = parseWeeklyDays(enrollment.class_days);
        }

        // 실제 납부 금액 계산
        const originalFee = parseFloat(enrollment.season_fee) || 0;
        const discountAmount = parseFloat(enrollment.discount_amount) || 0;
        const paidAmount = originalFee - discountAmount;

        // Calculate refund with new logic
        const refundResult = calculateSeasonRefund({
            paidAmount: paidAmount,
            originalFee: originalFee,
            seasonStartDate: new Date(enrollment.season_start_date),
            seasonEndDate: new Date(enrollment.season_end_date),
            cancellationDate: new Date(cancelDate),
            weeklyDays,
            includeVat: include_vat
        });

        // 최종 환불금액 (프론트에서 전달받은 값 우선, 없으면 계산값)
        const actualRefundAmount = final_refund_amount !== undefined
            ? parseFloat(final_refund_amount)
            : refundResult.finalRefundAmount;

        // Record refund expense if amount > 0 (삭제 전에 먼저 처리)
        if (actualRefundAmount > 0 && enrollment.payment_status === 'paid') {
            await db.query(
                `INSERT INTO expenses (
                    academy_id,
                    category,
                    amount,
                    expense_date,
                    description
                ) VALUES (?, 'refund', ?, ?, ?)`,
                [
                    enrollment.academy_id,
                    actualRefundAmount,
                    cancelDate,
                    `시즌 중도 해지 환불 - ${enrollment.student_name} (${enrollment.season_name})${include_vat ? ' (부가세 제외)' : ''}`
                ]
            );
        }

        // 시즌 등록 완전 삭제
        await db.query(`DELETE FROM student_seasons WHERE id = ?`, [enrollmentId]);

        // Update student's season registration status
        await db.query(
            `UPDATE students SET is_season_registered = false, current_season_id = NULL WHERE id = ?`,
            [enrollment.student_id]
        );

        // 시즌비 청구(student_payments)도 완전 삭제 (미납 건만)
        await db.query(
            `DELETE FROM student_payments
            WHERE student_id = ? AND payment_type = 'season' AND payment_status != 'paid'
            AND description LIKE ?`,
            [enrollment.student_id, `%${enrollment.season_name}%`]
        );

        res.json({
            message: 'Season enrollment deleted successfully',
            refundCalculation: refundResult
        });
    } catch (error) {
        logger.error('Error cancelling enrollment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to cancel enrollment'
        });
    }
});

/**
 * GET /paca/seasons/:id
 * Get season by ID
 * Access: owner, admin, teacher
 */
router.get('/:id', verifyToken, async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const [seasons] = await db.query(
            `SELECT * FROM seasons
            WHERE id = ? AND academy_id = ?`,
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found'
            });
        }

        // Get enrolled students count
        const [enrolledCount] = await db.query(
            `SELECT COUNT(*) as count FROM student_seasons
            WHERE season_id = ? AND payment_status != 'cancelled'`,
            [seasonId]
        );

        const season = seasons[0];
        season.enrolled_students = enrolledCount[0].count;

        res.json({ season });
    } catch (error) {
        logger.error('Error fetching season:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch season'
        });
    }
});

/**
 * POST /paca/seasons
 * Create new season
 * Access: owner, admin
 */
router.post('/', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    try {
        const {
            season_name,
            season_type,
            season_start_date,
            season_end_date,
            non_season_end_date,
            operating_days,
            grade_time_slots,
            default_season_fee,
            allows_continuous,
            continuous_to_season_type,
            continuous_discount_type,
            continuous_discount_rate
        } = req.body;

        if (!season_name || !season_type || !season_start_date || !season_end_date || !non_season_end_date || !operating_days) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Required fields: season_name, season_type, season_start_date, season_end_date, non_season_end_date, operating_days'
            });
        }

        // Validate season_type
        if (!['early', 'regular'].includes(season_type)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'season_type must be early or regular'
            });
        }

        // Validate dates
        const nonSeasonEnd = new Date(non_season_end_date);
        const seasonStart = new Date(season_start_date);
        const seasonEnd = new Date(season_end_date);

        if (nonSeasonEnd >= seasonStart) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'non_season_end_date must be before season_start_date'
            });
        }

        if (seasonStart >= seasonEnd) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'season_start_date must be before season_end_date'
            });
        }

        const [result] = await db.query(
            `INSERT INTO seasons (
                academy_id,
                season_name,
                season_type,
                season_start_date,
                season_end_date,
                non_season_end_date,
                operating_days,
                grade_time_slots,
                default_season_fee,
                allows_continuous,
                continuous_to_season_type,
                continuous_discount_type,
                continuous_discount_rate,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming')`,
            [
                req.user.academyId,
                season_name,
                season_type,
                season_start_date,
                season_end_date,
                non_season_end_date,
                JSON.stringify(operating_days),
                grade_time_slots ? JSON.stringify(grade_time_slots) : null,
                default_season_fee || 0,
                allows_continuous || false,
                continuous_to_season_type || null,
                continuous_discount_type || 'none',
                continuous_discount_rate || 0
            ]
        );

        const [created] = await db.query(
            'SELECT * FROM seasons WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            message: 'Season created successfully',
            season: created[0]
        });
    } catch (error) {
        logger.error('Error creating season:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to create season'
        });
    }
});

/**
 * PUT /paca/seasons/:id
 * Update season
 * Access: owner, admin
 */
router.put('/:id', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        // Verify exists and belongs to academy
        const [seasons] = await db.query(
            'SELECT * FROM seasons WHERE id = ? AND academy_id = ?',
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found'
            });
        }

        const {
            season_name,
            season_type,
            season_start_date,
            season_end_date,
            non_season_end_date,
            operating_days,
            grade_time_slots,
            default_season_fee,
            allows_continuous,
            continuous_to_season_type,
            continuous_discount_type,
            continuous_discount_rate,
            status
        } = req.body;

        const updates = [];
        const params = [];

        if (season_name !== undefined) {
            updates.push('season_name = ?');
            params.push(season_name);
        }
        if (season_type !== undefined) {
            updates.push('season_type = ?');
            params.push(season_type);
        }
        if (season_start_date !== undefined) {
            updates.push('season_start_date = ?');
            params.push(season_start_date);
        }
        if (season_end_date !== undefined) {
            updates.push('season_end_date = ?');
            params.push(season_end_date);
        }
        if (non_season_end_date !== undefined) {
            updates.push('non_season_end_date = ?');
            params.push(non_season_end_date);
        }
        if (operating_days !== undefined) {
            updates.push('operating_days = ?');
            params.push(JSON.stringify(operating_days));
        }
        if (grade_time_slots !== undefined) {
            updates.push('grade_time_slots = ?');
            params.push(grade_time_slots ? JSON.stringify(grade_time_slots) : null);
        }
        if (default_season_fee !== undefined) {
            updates.push('default_season_fee = ?');
            params.push(default_season_fee);
        }
        if (allows_continuous !== undefined) {
            updates.push('allows_continuous = ?');
            params.push(allows_continuous);
        }
        if (continuous_to_season_type !== undefined) {
            updates.push('continuous_to_season_type = ?');
            params.push(continuous_to_season_type);
        }
        if (continuous_discount_type !== undefined) {
            updates.push('continuous_discount_type = ?');
            params.push(continuous_discount_type);
        }
        if (continuous_discount_rate !== undefined) {
            updates.push('continuous_discount_rate = ?');
            params.push(continuous_discount_rate);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'No fields to update'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(seasonId);

        const oldSeason = seasons[0];
        const wasActive = oldSeason.status === 'active';
        const willBeActive = status === 'active';

        await db.query(
            `UPDATE seasons SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        const [updated] = await db.query(
            'SELECT * FROM seasons WHERE id = ?',
            [seasonId]
        );

        // 시즌이 active로 변경되면 등록된 학생들을 스케줄에 자동 배정
        let scheduleResult = null;
        if (!wasActive && willBeActive) {
            logger.info(`Season ${seasonId} activated - auto-assigning students to schedules`);
            scheduleResult = await autoAssignAllSeasonStudentsToSchedules(seasonId, req.user.academyId);
        }

        res.json({
            message: 'Season updated successfully',
            season: updated[0],
            scheduleAssignment: scheduleResult
        });
    } catch (error) {
        logger.error('Error updating season:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to update season'
        });
    }
});

/**
 * DELETE /paca/seasons/:id
 * Delete season (soft delete by setting status to 'ended')
 * Access: owner
 */
router.delete('/:id', verifyToken, requireRole('owner'), async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const [seasons] = await db.query(
            'SELECT * FROM seasons WHERE id = ? AND academy_id = ?',
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found'
            });
        }

        // Check if any students are enrolled
        const [enrolled] = await db.query(
            `SELECT COUNT(*) as count FROM student_seasons
            WHERE season_id = ? AND payment_status != 'cancelled'`,
            [seasonId]
        );

        if (enrolled[0].count > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: `Cannot delete season with ${enrolled[0].count} enrolled students`
            });
        }

        // Soft delete by setting status to 'ended'
        await db.query(
            `UPDATE seasons SET status = 'ended', updated_at = NOW() WHERE id = ?`,
            [seasonId]
        );

        res.json({
            message: 'Season deactivated successfully',
            season: {
                id: seasonId,
                season_name: seasons[0].season_name
            }
        });
    } catch (error) {
        logger.error('Error deleting season:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to delete season'
        });
    }
});

/**
 * POST /paca/seasons/:id/enroll
 * Enroll student to season with prorated fee calculation
 * Access: owner, admin
 */
router.post('/:id/enroll', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const {
            student_id,
            season_fee,
            registration_date,
            after_season_action,
            is_continuous,
            previous_season_id,
            time_slots,  // 고3/N수용 여러 시간대 배열: ['morning', 'afternoon', 'evening']
            discount_amount: manualDiscount,  // 수동 할인 금액 (사용자 입력)
            discount_reason  // 할인 사유
        } = req.body;

        if (!student_id || season_fee === undefined || season_fee === null) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Required fields: student_id, season_fee'
            });
        }

        // Verify season exists and belongs to academy
        const [seasons] = await db.query(
            `SELECT * FROM seasons WHERE id = ? AND academy_id = ? AND status != 'ended'`,
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found or ended'
            });
        }

        const season = seasons[0];

        // Verify student exists and belongs to academy
        const [students] = await db.query(
            'SELECT * FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        const student = students[0];

        // Check if already enrolled
        const [existing] = await db.query(
            `SELECT id FROM student_seasons
            WHERE student_id = ? AND season_id = ? AND payment_status != 'cancelled'`,
            [student_id, seasonId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Student already enrolled in this season'
            });
        }

        // Calculate prorated fee (비시즌 일할계산 - optional)
        // 수업요일이 설정되어 있고 비시즌 종강일이 있을 때만 계산
        let proRated = { proRatedFee: 0 };
        let proRatedMonth = null;

        if (student.class_days && season.non_season_end_date) {
            try {
                const weeklyDays = parseWeeklyDays(student.class_days);
                const nonSeasonEnd = new Date(season.non_season_end_date);
                proRatedMonth = `${nonSeasonEnd.getFullYear()}-${String(nonSeasonEnd.getMonth() + 1).padStart(2, '0')}`;

                proRated = calculateProRatedFee({
                    monthlyFee: parseFloat(student.monthly_tuition) || 0,
                    weeklyDays,
                    nonSeasonEndDate: nonSeasonEnd,
                    discountRate: parseFloat(student.discount_rate) || 0
                });
            } catch (proRateError) {
                logger.info('ProRated calculation skipped:', proRateError.message);
            }
        }

        // 시즌 중간 합류 시 일할계산
        const regDate = new Date(registration_date || new Date());
        const seasonStartDate = new Date(season.season_start_date);
        const seasonEndDate = new Date(season.season_end_date);

        let baseSeasonFee = parseFloat(season_fee) || 0;
        let midSeasonProRated = null;

        // 등록일이 시즌 시작일 이후이면 일할계산
        if (regDate > seasonStartDate && season.operating_days) {
            try {
                const operatingDays = typeof season.operating_days === 'string'
                    ? JSON.parse(season.operating_days)
                    : season.operating_days;

                if (Array.isArray(operatingDays) && operatingDays.length > 0) {
                    // 운영 요일을 숫자 배열로 변환
                    const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
                    const weeklyDaysForSeason = operatingDays.map(d => typeof d === 'string' ? dayMap[d] : d).filter(d => d !== undefined);

                    midSeasonProRated = calculateMidSeasonFee({
                        seasonFee: baseSeasonFee,
                        seasonStartDate: seasonStartDate,
                        seasonEndDate: seasonEndDate,
                        joinDate: regDate,
                        weeklyDays: weeklyDaysForSeason
                    });

                    // 일할계산된 시즌비로 대체
                    baseSeasonFee = midSeasonProRated.proRatedFee;
                }
            } catch (midSeasonError) {
                logger.info('Mid-season prorated calculation skipped:', midSeasonError.message);
            }
        }

        // Calculate discount for continuous enrollment
        let discountType = 'none';
        let discountAmount = 0;
        let finalSeasonFee = baseSeasonFee;

        if (is_continuous && previous_season_id && season.continuous_discount_type !== 'none') {
            discountType = season.continuous_discount_type;
            if (discountType === 'free') {
                discountAmount = finalSeasonFee;
                finalSeasonFee = 0;
            } else if (discountType === 'rate' && season.continuous_discount_rate > 0) {
                discountAmount = truncateToThousands(finalSeasonFee * (season.continuous_discount_rate / 100));
                finalSeasonFee -= discountAmount;
            }
        }

        // 수동 할인 금액 적용 (사용자가 직접 입력한 할인)
        if (manualDiscount && parseFloat(manualDiscount) > 0) {
            const manualDiscountValue = parseFloat(manualDiscount) || 0;
            discountAmount += manualDiscountValue;
            finalSeasonFee -= manualDiscountValue;
            if (finalSeasonFee < 0) finalSeasonFee = 0;
            if (discountType === 'none') discountType = 'manual';
        }

        // NaN 안전 검사 - 모든 금액 값이 유효한지 확인
        if (isNaN(baseSeasonFee)) baseSeasonFee = parseFloat(season_fee) || 0;
        if (isNaN(finalSeasonFee)) finalSeasonFee = baseSeasonFee;
        if (isNaN(discountAmount)) discountAmount = 0;

        // Validate time_slots if provided
        const validTimeSlots = ['morning', 'afternoon', 'evening'];
        let parsedTimeSlots = null;
        if (time_slots && Array.isArray(time_slots) && time_slots.length > 0) {
            // 유효한 시간대만 필터링
            parsedTimeSlots = time_slots.filter(ts => validTimeSlots.includes(ts));
            if (parsedTimeSlots.length === 0) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid time_slots. Must be array of: morning, afternoon, evening'
                });
            }
        }

        // Enroll student
        const [result] = await db.query(
            `INSERT INTO student_seasons (
                student_id,
                season_id,
                season_fee,
                registration_date,
                after_season_action,
                prorated_month,
                prorated_amount,
                prorated_details,
                is_continuous,
                previous_season_id,
                discount_type,
                discount_amount,
                discount_reason,
                time_slots,
                payment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                student_id,
                seasonId,
                finalSeasonFee || 0,  // NaN 방지
                registration_date || new Date().toISOString().split('T')[0],
                after_season_action || 'regular',
                proRatedMonth,
                proRated?.proRatedFee || 0,  // NaN 방지
                JSON.stringify(proRated || { proRatedFee: 0 }),
                is_continuous || false,
                previous_season_id || null,
                discountType,
                discountAmount || 0,  // NaN 방지
                discount_reason || null,
                parsedTimeSlots ? JSON.stringify(parsedTimeSlots) : null
            ]
        );

        // Update student's season registration status
        await db.query(
            `UPDATE students SET is_season_registered = true, current_season_id = ? WHERE id = ?`,
            [seasonId, student_id]
        );

        // 시즌비 청구 자동 생성 (student_payments 테이블)
        const yearMonth = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}`;

        // 납부일 계산
        // - 시즌 시작 전 등록: 시즌 시작일 전까지 납부
        // - 시즌 중간 합류: 등록일 + 7일 (시즌이 이미 시작됐으므로)
        const dueDate = new Date(regDate);
        dueDate.setDate(dueDate.getDate() + 7);
        let actualDueDate;
        if (regDate > seasonStartDate) {
            // 시즌 중간 합류: 등록일 + 7일
            actualDueDate = dueDate;
        } else {
            // 시즌 시작 전 등록: 시즌 시작일과 등록일+7일 중 빠른 날
            actualDueDate = dueDate < seasonStartDate ? dueDate : seasonStartDate;
        }

        // 시즌비 설명 (일할계산 여부 포함)
        let seasonFeeDescription = `${season.season_name} 시즌비`;
        if (midSeasonProRated && midSeasonProRated.isProRated) {
            seasonFeeDescription += ` (중간합류 일할: ${midSeasonProRated.details})`;
        }

        await db.query(
            `INSERT INTO student_payments (
                student_id,
                academy_id,
                \`year_month\`,
                payment_type,
                base_amount,
                discount_amount,
                additional_amount,
                final_amount,
                due_date,
                payment_status,
                description,
                recorded_by
            ) VALUES (?, ?, ?, 'season', ?, ?, 0, ?, ?, 'pending', ?, ?)`,
            [
                student_id,
                req.user.academyId,
                yearMonth,
                parseFloat(season_fee) || 0,  // 원래 시즌비 (일할 전) - NaN 방지
                discountAmount + (midSeasonProRated?.discount || 0),  // 총 할인액 (연속등록 + 일할) - NaN 방지
                finalSeasonFee || 0,  // 최종 금액 - NaN 방지
                actualDueDate.toISOString().split('T')[0],
                seasonFeeDescription,
                req.user.userId
            ]
        );

        // ============================================================
        // 시즌 스케줄 자동 배치 (시즌이 active 상태일 때만)
        // ============================================================

        let removeResult = null;
        let seasonAssignResult = null;

        if (season.status === 'active') {
            // 1. 기존 정규 스케줄에서 시즌 기간 동안 제거
            try {
                removeResult = await removeStudentFromRegularSchedules(
                    student_id,
                    req.user.academyId,
                    season.season_start_date,
                    season.season_end_date
                );
            } catch (removeError) {
                logger.error('Remove from regular schedules failed:', removeError);
            }

            // 2. 시즌 스케줄에 자동 배정
            try {
                // 학년 문자열 생성 (예: "고3", "N수" 등)
                const studentGrade = student.grade || '';

                // 고3/N수는 여러 시간대 지원
                // parsedTimeSlots가 있으면 사용, 없으면 기본 로직 적용
                // registrationDate를 전달하여 등록일 이후부터만 스케줄 배정
                const regDateStr = registration_date || new Date().toISOString().split('T')[0];
                seasonAssignResult = await autoAssignStudentToSeasonSchedules(
                    student_id,
                    req.user.academyId,
                    season,
                    studentGrade,
                    student.student_type,
                    parsedTimeSlots,  // 사용자 지정 시간대 배열
                    regDateStr        // 등록일 (이 날짜 이후부터만 스케줄 배정)
                );
            } catch (assignError) {
                logger.error('Season auto-assign failed:', assignError);
            }
        } else {
            logger.info(`Season ${seasonId} is not active (status: ${season.status}), skipping auto-assignment`);
        }

        // Get enrollment details
        const [enrollment] = await db.query(
            `SELECT
                ss.*,
                s.name as student_name,
                se.season_name,
                se.season_type
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [result.insertId]
        );

        // 학생 이름 복호화
        if (enrollment[0]) {
            enrollment[0].student_name = decrypt(enrollment[0].student_name);
        }

        res.status(201).json({
            message: 'Student enrolled in season successfully',
            enrollment: enrollment[0],
            proRatedCalculation: proRated,
            midSeasonProRated: midSeasonProRated,  // 시즌 중간 합류 일할계산 정보
            schedule_assignment: {
                removed_from_regular: removeResult,
                assigned_to_season: seasonAssignResult
            }
        });
    } catch (error) {
        logger.error('Error enrolling student:', error);
        logger.error('Request body:', req.body);
        res.status(500).json({
            error: 'Server Error',
            message: error.message || 'Failed to enroll student',
            details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
        });
    }
});

/**
 * GET /paca/seasons/:id/students
 * Get enrolled students for season
 * Access: owner, admin, teacher
 */
router.get('/:id/students', verifyToken, async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const [enrollments] = await db.query(
            `SELECT
                ss.*,
                s.name as student_name,
                s.student_number,
                s.phone as student_phone,
                s.parent_phone,
                s.class_days,
                s.grade as student_grade
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            WHERE ss.season_id = ?
            AND s.academy_id = ?
            ORDER BY ss.registration_date DESC`,
            [seasonId, req.user.academyId]
        );

        // 학생 정보 복호화
        enrollments.forEach(e => {
            e.student_name = decrypt(e.student_name);
            e.student_phone = decrypt(e.student_phone);
            e.parent_phone = decrypt(e.parent_phone);
        });

        res.json({
            message: `Found ${enrollments.length} enrolled students`,
            enrolled_students: enrollments
        });
    } catch (error) {
        logger.error('Error fetching enrolled students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch enrolled students'
        });
    }
});

/**
 * DELETE /paca/seasons/:id/students/:student_id
 * Cancel student enrollment from season
 * Access: owner, admin
 */
router.delete('/:id/students/:student_id', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const seasonId = parseInt(req.params.id);
    const studentId = parseInt(req.params.student_id);

    try {
        // Get enrollment
        const [enrollments] = await db.query(
            `SELECT
                ss.*,
                s.academy_id,
                s.name as student_name,
                s.class_days,
                se.season_name,
                se.season_start_date,
                se.season_end_date
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.season_id = ? AND ss.student_id = ?`,
            [seasonId, studentId]
        );

        if (enrollments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Enrollment not found'
            });
        }

        const enrollment = enrollments[0];
        // 학생 이름 복호화
        enrollment.student_name = decrypt(enrollment.student_name);

        if (enrollment.academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }

        if (enrollment.payment_status === 'cancelled') {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Enrollment already cancelled'
            });
        }

        const cancelDate = new Date().toISOString().split('T')[0];
        const weeklyDays = parseWeeklyDays(enrollment.class_days);

        // Calculate refund
        const refundResult = calculateSeasonRefund({
            seasonFee: parseFloat(enrollment.season_fee),
            seasonStartDate: new Date(enrollment.season_start_date),
            seasonEndDate: new Date(enrollment.season_end_date),
            cancellationDate: new Date(cancelDate),
            weeklyDays,
            refundPolicy: 'legal'
        });

        // Record refund expense if amount > 0 (삭제 전에 먼저 처리)
        if (refundResult.refundAmount > 0 && enrollment.payment_status === 'paid') {
            await db.query(
                `INSERT INTO expenses (
                    academy_id,
                    category,
                    amount,
                    expense_date,
                    description
                ) VALUES (?, 'refund', ?, ?, ?)`,
                [
                    enrollment.academy_id,
                    refundResult.refundAmount,
                    cancelDate,
                    `시즌 중도 해지 환불 - ${enrollment.student_name} (${enrollment.season_name})`
                ]
            );
        }

        // 시즌 등록 완전 삭제
        await db.query(`DELETE FROM student_seasons WHERE id = ?`, [enrollment.id]);

        // Update student's season registration status
        await db.query(
            `UPDATE students SET is_season_registered = false, current_season_id = NULL WHERE id = ?`,
            [studentId]
        );

        // 시즌비 청구(student_payments)도 완전 삭제 (미납 건만)
        await db.query(
            `DELETE FROM student_payments
            WHERE student_id = ? AND payment_type = 'season' AND payment_status != 'paid'
            AND description LIKE ?`,
            [studentId, `%${enrollment.season_name}%`]
        );

        res.json({
            message: 'Season enrollment deleted successfully',
            refundCalculation: refundResult
        });
    } catch (error) {
        logger.error('Error cancelling enrollment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to cancel enrollment'
        });
    }
});

/**
 * GET /paca/seasons/:id/preview
 * Preview prorated fee calculation for student
 * Access: owner, admin
 */
router.get('/:id/preview', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const { student_id } = req.query;

        if (!student_id) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Required field: student_id'
            });
        }

        // Get season info
        const [seasons] = await db.query(
            'SELECT * FROM seasons WHERE id = ? AND academy_id = ?',
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found'
            });
        }

        // Check if student is already enrolled in this season
        const [existingEnrollment] = await db.query(
            `SELECT ss.id, s.season_name
             FROM student_seasons ss
             JOIN seasons s ON ss.season_id = s.id
             WHERE ss.student_id = ? AND ss.season_id = ? AND ss.is_cancelled = 0`,
            [student_id, seasonId]
        );

        if (existingEnrollment.length > 0) {
            return res.status(409).json({
                error: 'Already Enrolled',
                message: `이미 ${existingEnrollment[0].season_name}에 등록되어 있습니다.`,
                enrolled: true
            });
        }

        // Get student info
        const [students] = await db.query(
            'SELECT * FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        const season = seasons[0];
        const student = students[0];
        // 학생 이름 복호화
        student.name = decrypt(student.name);

        // Calculate prorated fee
        const weeklyDays = parseWeeklyDays(student.class_days);
        const nonSeasonEnd = new Date(season.non_season_end_date);
        const seasonStart = new Date(season.season_start_date);
        const seasonEnd = new Date(season.season_end_date);

        const proRated = calculateProRatedFee({
            monthlyFee: parseFloat(student.monthly_tuition) || 0,
            weeklyDays,
            nonSeasonEndDate: nonSeasonEnd,
            discountRate: parseFloat(student.discount_rate) || 0
        });

        // 시즌 중간 합류 일할계산 (registration_date가 시즌 시작일 이후인 경우)
        const { registration_date } = req.query;
        let midSeasonProRated = null;
        let finalSeasonFee = parseFloat(season.default_season_fee) || 0;

        if (registration_date) {
            const regDate = new Date(registration_date);
            if (regDate > seasonStart) {
                const operatingDays = typeof season.operating_days === 'string'
                    ? JSON.parse(season.operating_days)
                    : season.operating_days;

                const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
                const weeklyDaysForSeason = operatingDays.map(d => typeof d === 'string' ? dayMap[d] : d).filter(d => d !== undefined);

                midSeasonProRated = calculateMidSeasonFee({
                    seasonFee: finalSeasonFee,
                    seasonStartDate: seasonStart,
                    seasonEndDate: seasonEnd,
                    joinDate: regDate,
                    weeklyDays: weeklyDaysForSeason
                });

                finalSeasonFee = midSeasonProRated.proRatedFee;
            }
        }

        // Calculate gap period
        const gapStart = new Date(nonSeasonEnd);
        gapStart.setDate(gapStart.getDate() + 1);
        const gapEnd = new Date(seasonStart);
        gapEnd.setDate(gapEnd.getDate() - 1);
        const hasGap = gapStart <= gapEnd;

        // Check for continuous enrollment discount
        let continuousDiscount = null;
        if (season.allows_continuous && season.continuous_discount_type !== 'none') {
            continuousDiscount = {
                type: season.continuous_discount_type,
                rate: season.continuous_discount_rate,
                description: season.continuous_discount_type === 'free'
                    ? '연속등록 시 무료'
                    : `연속등록 시 ${season.continuous_discount_rate}% 할인`
            };
        }

        const preview = {
            student: {
                id: student.id,
                name: student.name,
                student_number: student.student_number || '',
                class_days: weeklyDays,
                monthly_tuition: student.monthly_tuition,
                discount_rate: student.discount_rate || '0'
            },
            season: {
                id: season.id,
                season_name: season.season_name,
                start_date: season.season_start_date,
                end_date: season.season_end_date,
                non_season_end_date: season.non_season_end_date,
                season_fee: season.default_season_fee
            },
            prorated: {
                total_days: proRated.totalMonthlyClasses || 30,
                pro_rated_days: proRated.classCountUntilEnd || 0,
                daily_rate: proRated.perClassFee || 0,
                original_monthly: parseFloat(student.monthly_tuition) || 0,
                discount_rate: parseFloat(student.discount_rate) || 0,
                final_amount: proRated.proRatedFee || 0
            },
            mid_season_prorated: midSeasonProRated ? {
                is_mid_season: true,
                original_fee: midSeasonProRated.originalFee,
                prorated_fee: midSeasonProRated.proRatedFee,
                discount: midSeasonProRated.discount,
                total_days: midSeasonProRated.totalDays,
                remaining_days: midSeasonProRated.remainingDays,
                details: midSeasonProRated.details
            } : null,
            continuous_discount: continuousDiscount ? {
                is_continuous: true,
                discount_type: continuousDiscount.type,
                discount_rate: continuousDiscount.rate || 0,
                discount_amount: 0
            } : null,
            final_calculation: {
                season_fee: finalSeasonFee,
                original_season_fee: parseFloat(season.default_season_fee) || 0,
                mid_season_discount: midSeasonProRated ? midSeasonProRated.discount : 0,
                // 비시즌 일할은 시즌 전달 학원비에서 별도 처리 (시즌 등록에 포함 X)
                prorated_fee: 0,
                discount_amount: 0,
                total_due: finalSeasonFee  // 시즌비만
            },
            // 비시즌 일할 정보 (참고용 - 시즌 전달 학원비에서 청구됨)
            non_season_prorated_info: proRated.proRatedFee > 0 ? {
                amount: proRated.proRatedFee,
                days: proRated.proRatedDays || 0,
                message: '비시즌 일할은 시즌 전달 학원비에서 별도 청구됩니다.'
            } : null
        };

        res.json({
            message: 'Season transition preview calculated',
            preview
        });
    } catch (error) {
        logger.error('Error calculating preview:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to calculate preview'
        });
    }
});

module.exports = router;
