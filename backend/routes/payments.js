const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole, checkPermission } = require('../middleware/auth');
const { truncateToThousands, calculateProRatedFee, parseWeeklyDays } = require('../utils/seasonCalculator');
const { decrypt } = require('../utils/encryption');
const { calculateDueDate } = require('../utils/dueDateCalculator');
const logger = require('../utils/logger');

// 학생 이름 복호화 헬퍼
function decryptStudentName(obj) {
    if (!obj) return obj;
    if (obj.student_name) obj.student_name = decrypt(obj.student_name);
    if (obj.name) obj.name = decrypt(obj.name);
    return obj;
}
function decryptPaymentArray(arr) {
    return arr.map(item => decryptStudentName({...item}));
}

/**
 * 비시즌 종강 일할 계산 (다음 달 비시즌 종강일까지의 수업료)
 * @param {object} params - 파라미터
 * @param {number} params.studentId - 학생 ID
 * @param {number} params.academyId - 학원 ID
 * @param {number} params.year - 청구 연도
 * @param {number} params.month - 청구 월
 * @returns {object|null} 비시즌 종강 일할 정보 또는 null
 */
async function calculateNonSeasonEndProrated(params) {
    const { studentId, academyId, year, month } = params;

    // 다음 달 계산
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear = year + 1;
    }

    // 다음 달에 시작하는 시즌 조회 (해당 학생이 등록된)
    const [seasonEnrollments] = await db.query(
        `SELECT
            se.id as enrollment_id,
            se.student_id,
            s.id as season_id,
            s.name as season_name,
            s.start_date,
            s.end_date,
            s.non_season_end_date,
            st.monthly_tuition,
            st.discount_rate,
            st.weekly_schedule
        FROM student_seasons se
        JOIN seasons s ON se.season_id = s.id
        JOIN students st ON se.student_id = st.id
        WHERE se.student_id = ?
        AND se.status = 'active'
        AND s.academy_id = ?
        AND YEAR(s.start_date) = ?
        AND MONTH(s.start_date) = ?
        AND s.non_season_end_date IS NOT NULL
        AND s.non_season_end_date >= ?`,
        [studentId, academyId, nextYear, nextMonth, `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`]
    );

    if (seasonEnrollments.length === 0) {
        return null;
    }

    const enrollment = seasonEnrollments[0];
    const nonSeasonEndDate = new Date(enrollment.non_season_end_date);

    // 비시즌 종강일이 다음 달 1일 이후인지 확인
    const nextMonthStart = new Date(nextYear, nextMonth - 1, 1);
    if (nonSeasonEndDate < nextMonthStart) {
        return null; // 비시즌 종강일이 다음 달 전이면 일할 계산 필요 없음
    }

    // 비시즌 종강일이 시즌 시작일 이후이면 일할 계산 필요 없음
    const seasonStartDate = new Date(enrollment.start_date);
    if (nonSeasonEndDate >= seasonStartDate) {
        return null;
    }

    // 수업 요일 파싱
    const weeklyDays = parseWeeklyDays(enrollment.weekly_schedule);
    if (weeklyDays.length === 0) {
        return null;
    }

    // 비시즌 종강 일할 계산
    const proRatedResult = calculateProRatedFee({
        monthlyFee: parseFloat(enrollment.monthly_tuition) || 0,
        weeklyDays,
        nonSeasonEndDate,
        discountRate: parseFloat(enrollment.discount_rate) || 0
    });

    if (proRatedResult.proRatedFee <= 0) {
        return null;
    }

    return {
        amount: proRatedResult.proRatedFee,
        seasonName: enrollment.season_name,
        nonSeasonEndDate: enrollment.non_season_end_date,
        classCount: proRatedResult.classCountUntilEnd,
        totalMonthlyClasses: proRatedResult.totalMonthlyClasses,
        description: `비시즌 종강 일할 (${nextMonth}월 1일~${nonSeasonEndDate.getDate()}일, ${proRatedResult.classCountUntilEnd}회)`,
        details: proRatedResult.calculationDetails
    };
}

/**
 * GET /paca/payments
 * Get all payment records with filters
 * Access: owner, admin, staff (with payments view permission)
 */
router.get('/', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        const { student_id, payment_status, payment_type, year, month, paid_year, paid_month, include_previous_unpaid } = req.query;

        let query = `
            SELECT
                p.id,
                p.student_id,
                s.name as student_name,
                s.student_number,
                s.grade,
                p.year_month,
                p.payment_type,
                p.base_amount,
                p.discount_amount,
                p.additional_amount,
                p.final_amount,
                p.paid_date,
                p.due_date,
                p.payment_status,
                p.payment_method,
                p.description,
                p.notes,
                p.created_at,
                COALESCE((
                    SELECT SUM(rc.remaining_amount)
                    FROM rest_credits rc
                    WHERE rc.student_id = p.student_id
                    AND rc.academy_id = p.academy_id
                    AND rc.status IN ('pending', 'partial')
                    AND rc.remaining_amount > 0
                ), 0) as credit_balance
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.academy_id = ?
        `;

        const params = [req.user.academyId];

        if (student_id) {
            query += ' AND p.student_id = ?';
            params.push(parseInt(student_id));
        }

        if (payment_status) {
            query += ' AND p.payment_status = ?';
            params.push(payment_status);
        }

        if (payment_type) {
            query += ' AND p.payment_type = ?';
            params.push(payment_type);
        }

        if (year && month) {
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            if (include_previous_unpaid === 'true') {
                // 해당 월 + 이전 달 미납자 (paid가 아닌 것)
                query += ` AND (p.year_month = ? OR (p.year_month < ? AND p.payment_status != 'paid'))`;
                params.push(yearMonth, yearMonth);
            } else {
                query += ` AND p.year_month = ?`;
                params.push(yearMonth);
            }
        }

        // paid_year, paid_month: 실제 납부일 기준 필터 (리포트 매출용)
        if (paid_year && paid_month) {
            query += ` AND DATE_FORMAT(p.paid_date, '%Y-%m') = ?`;
            params.push(`${paid_year}-${String(paid_month).padStart(2, '0')}`);
        }

        // 미납/부분납 먼저, 완납은 맨 뒤로 정렬
        query += ' ORDER BY CASE WHEN p.payment_status = \'paid\' THEN 1 ELSE 0 END, p.due_date DESC';

        const [payments] = await db.query(query, params);

        res.json({
            message: `Found ${payments.length} payment records`,
            payments: decryptPaymentArray(payments)
        });
    } catch (error) {
        logger.error('Error fetching payments:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역을 불러오는데 실패했습니다.'
        });
    }
});

/**
 * GET /paca/payments/unpaid
 * Get all unpaid/overdue payments
 * Access: owner, admin
 */
router.get('/unpaid', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        const [payments] = await db.query(
            `SELECT
                p.id,
                p.student_id,
                s.name as student_name,
                s.student_number,
                s.phone,
                s.parent_phone,
                p.year_month,
                p.payment_type,
                p.base_amount,
                p.discount_amount,
                p.additional_amount,
                p.final_amount,
                p.due_date,
                p.payment_status,
                DATEDIFF(CURDATE(), p.due_date) as days_overdue
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.academy_id = ?
            AND p.payment_status IN ('pending', 'partial')
            ORDER BY p.due_date ASC`,
            [req.user.academyId]
        );

        res.json({
            message: `Found ${payments.length} unpaid payments`,
            payments: decryptPaymentArray(payments)
        });
    } catch (error) {
        logger.error('Error fetching unpaid payments:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '미납 내역을 불러오는데 실패했습니다.'
        });
    }
});

/**
 * GET /paca/payments/unpaid-today
 * Get unpaid payments for students who have class today
 * 오늘 수업이 있는 학생 중 미납자만 반환
 * Access: owner, admin, n8n service account
 */
router.get('/unpaid-today', verifyToken, async (req, res) => {
    try {
        // 오늘 요일 (0=일, 1=월, ..., 6=토)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const todayStr = today.toISOString().split('T')[0];

        const [payments] = await db.query(
            `SELECT
                p.id,
                p.student_id,
                s.name as student_name,
                s.student_number,
                s.grade,
                s.phone,
                s.parent_phone,
                s.class_days,
                p.year_month,
                p.payment_type,
                p.base_amount,
                p.discount_amount,
                p.additional_amount,
                p.final_amount,
                p.paid_amount,
                p.due_date,
                p.payment_status,
                DATEDIFF(CURDATE(), p.due_date) as days_overdue,
                (
                    SELECT a.attendance_status
                    FROM attendance a
                    JOIN class_schedules cs ON a.class_schedule_id = cs.id
                    WHERE a.student_id = s.id
                    AND cs.class_date = ?
                    AND cs.academy_id = ?
                    ORDER BY a.id DESC
                    LIMIT 1
                ) as today_attendance
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.academy_id = ?
            AND p.payment_status IN ('pending', 'partial')
            AND p.year_month <= ?
            AND s.status = 'active'
            AND s.deleted_at IS NULL
            AND JSON_CONTAINS(COALESCE(s.class_days, '[]'), ?)
            HAVING today_attendance IS NULL OR today_attendance NOT IN ('absent', 'excused')
            ORDER BY p.year_month DESC, s.name ASC`,
            [todayStr, req.user.academyId, req.user.academyId, yearMonth, JSON.stringify(dayOfWeek)]
        );

        res.json({
            message: `오늘(${['일','월','화','수','목','금','토'][dayOfWeek]}요일) 수업 있는 미납자 ${payments.length}명`,
            date: todayStr,
            day_of_week: dayOfWeek,
            day_name: ['일','월','화','수','목','금','토'][dayOfWeek],
            count: payments.length,
            payments: decryptPaymentArray(payments)
        });
    } catch (error) {
        logger.error('Error fetching unpaid-today payments:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '오늘 미납 내역을 불러오는데 실패했습니다.'
        });
    }
});

// ===== 크레딧 관리 API =====

/**
 * GET /paca/payments/credits
 * 전체 크레딧 목록 조회 (학원 전체)
 */
router.get('/credits', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        const { status, credit_type } = req.query;

        let whereClause = 'rc.academy_id = ?';
        const params = [req.user.academyId];

        if (status && status !== 'all') {
            whereClause += ' AND rc.status = ?';
            params.push(status);
        }

        if (credit_type && credit_type !== 'all') {
            whereClause += ' AND rc.credit_type = ?';
            params.push(credit_type);
        }

        const [credits] = await db.query(
            `SELECT rc.*, s.name as student_name, s.status as student_status
             FROM rest_credits rc
             JOIN students s ON rc.student_id = s.id
             WHERE ${whereClause}
             ORDER BY rc.created_at DESC`,
            params
        );

        // 학생 이름 복호화
        const decryptedCredits = credits.map(c => ({
            ...c,
            student_name: decrypt(c.student_name) || c.student_name
        }));

        // 통계
        const [stats] = await db.query(
            `SELECT
                COUNT(*) as total_count,
                SUM(credit_amount) as total_credit,
                SUM(remaining_amount) as total_remaining,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'pending' THEN remaining_amount ELSE 0 END) as pending_amount,
                SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied_count
             FROM rest_credits
             WHERE academy_id = ?`,
            [req.user.academyId]
        );

        res.json({
            credits: decryptedCredits,
            stats: stats[0] || {
                total_count: 0,
                total_credit: 0,
                total_remaining: 0,
                pending_count: 0,
                pending_amount: 0,
                partial_count: 0,
                applied_count: 0
            }
        });
    } catch (error) {
        logger.error('Error fetching all credits:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 목록 조회에 실패했습니다.'
        });
    }
});

/**
 * GET /paca/payments/credits/summary
 * 크레딧 요약 통계
 */
router.get('/credits/summary', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        // 잔여 크레딧이 있는 학생 목록
        const [studentsWithCredit] = await db.query(
            `SELECT s.id, s.name, s.status as student_status,
                    SUM(rc.remaining_amount) as total_remaining,
                    COUNT(rc.id) as credit_count
             FROM rest_credits rc
             JOIN students s ON rc.student_id = s.id
             WHERE rc.academy_id = ? AND rc.remaining_amount > 0
             GROUP BY s.id, s.name, s.status
             ORDER BY total_remaining DESC`,
            [req.user.academyId]
        );

        const decryptedStudents = studentsWithCredit.map(s => ({
            ...s,
            name: decrypt(s.name) || s.name
        }));

        // 크레딧 타입별 통계
        const [typeStats] = await db.query(
            `SELECT credit_type,
                    COUNT(*) as count,
                    SUM(credit_amount) as total_amount,
                    SUM(remaining_amount) as remaining_amount
             FROM rest_credits
             WHERE academy_id = ?
             GROUP BY credit_type`,
            [req.user.academyId]
        );

        res.json({
            students_with_credit: decryptedStudents,
            type_stats: typeStats
        });
    } catch (error) {
        logger.error('Error fetching credit summary:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 요약 조회에 실패했습니다.'
        });
    }
});

/**
 * GET /paca/payments/:id
 * Get payment by ID
 * Access: owner, admin
 */
router.get('/:id', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    const paymentId = parseInt(req.params.id);

    try {
        const [payments] = await db.query(
            `SELECT
                p.*,
                s.name as student_name,
                s.student_number,
                s.phone,
                s.parent_phone
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?
            AND s.academy_id = ?`,
            [paymentId, req.user.academyId]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '납부 내역을 찾을 수 없습니다.'
            });
        }

        res.json({
            payment: decryptStudentName(payments[0])
        });
    } catch (error) {
        logger.error('Error fetching payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역을 불러오는데 실패했습니다.'
        });
    }
});

/**
 * POST /paca/payments
 * Create new payment record (charge)
 * Access: owner, admin
 */
router.post('/', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    try {
        const {
            student_id,
            payment_type,
            base_amount,
            discount_amount,
            additional_amount,
            due_date,
            year_month,
            notes,
            description
        } = req.body;

        // Validation
        if (!student_id || !payment_type || !base_amount || !due_date || !year_month) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '필수 항목을 모두 입력해주세요. (학생, 결제유형, 금액, 납부기한, 청구월)'
            });
        }

        // Verify student exists and belongs to this academy
        const [students] = await db.query(
            'SELECT id, academy_id FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생을 찾을 수 없습니다.'
            });
        }

        // Calculate final_amount (백원 단위 절삭)
        const finalAmount = truncateToThousands(
            parseFloat(base_amount) - parseFloat(discount_amount || 0) + parseFloat(additional_amount || 0)
        );

        // Insert payment record
        const [result] = await db.query(
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
                notes,
                recorded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
            [
                student_id,
                students[0].academy_id,
                year_month,
                payment_type,
                base_amount,
                discount_amount || 0,
                additional_amount || 0,
                finalAmount,
                due_date,
                description || null,
                notes || null,
                req.user.userId
            ]
        );

        // Fetch created payment
        const [payments] = await db.query(
            `SELECT
                p.*,
                s.name as student_name,
                s.student_number
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            message: '납부 내역이 생성되었습니다.',
            payment: payments[0]
        });
    } catch (error) {
        logger.error('Error creating payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역 생성에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/payments/bulk-monthly
 * Create monthly tuition charges for all active students
 * Access: owner, admin
 */
router.post('/bulk-monthly', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    try {
        const { year, month } = req.body;

        if (!year || !month) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '필수 항목을 모두 입력해주세요. (연도, 월)'
            });
        }

        // 학원 설정에서 기본 납부일 가져오기
        const [academySettings] = await db.query(
            `SELECT tuition_due_day FROM academies WHERE id = ?`,
            [req.user.academyId]
        );
        const defaultDueDay = academySettings[0]?.tuition_due_day || 1;

        // Get all active students
        const [students] = await db.query(
            `SELECT
                id,
                name,
                student_number,
                monthly_tuition,
                discount_rate,
                class_days,
                payment_due_day
            FROM students
            WHERE academy_id = ?
            AND status = 'active'
            AND deleted_at IS NULL`,
            [req.user.academyId]
        );

        if (students.length === 0) {
            return res.json({
                message: '활성 상태인 학생이 없습니다.',
                created: 0,
                updated: 0
            });
        }

        // Create or update payment records for all students
        let created = 0;
        let updated = 0;
        let skipped = 0;
        let withNonSeasonProrated = 0;
        let withCarryover = 0;
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

        for (const student of students) {
            // 학생별 납부기한 계산 (스케줄러와 동일한 로직)
            const studentDueDay = student.payment_due_day || defaultDueDay;
            let classDays = [];
            try {
                classDays = student.class_days ? JSON.parse(student.class_days) : [];
            } catch (e) {
                classDays = [];
            }
            const due_date = calculateDueDate(year, month, studentDueDay, classDays);

            const baseAmount = parseFloat(student.monthly_tuition) || 0;
            const discountRate = parseFloat(student.discount_rate) || 0;
            const discount = truncateToThousands(baseAmount * (discountRate / 100));

            // 비시즌 종강 일할 계산 (다음 달 비시즌 종강일까지)
            let additionalAmount = 0;
            let notes = null;
            let description = `${year}년 ${month}월 수강료`;

            try {
                const nonSeasonProrated = await calculateNonSeasonEndProrated({
                    studentId: student.id,
                    academyId: req.user.academyId,
                    year,
                    month
                });

                if (nonSeasonProrated) {
                    additionalAmount = nonSeasonProrated.amount;
                    notes = `[비시즌 종강 일할] ${nonSeasonProrated.description}\n${nonSeasonProrated.details.formula}`;
                    description = `${year}년 ${month}월 수강료 + 비시즌 종강 일할`;
                    withNonSeasonProrated++;
                }
            } catch (err) {
                logger.error(`Failed to calculate non-season prorated for student ${student.id}:`, err);
            }

            // 휴식 이월(carryover) + 공결(excused) + 수동(manual) 크레딧 확인 및 적용
            let carryoverAmount = 0;
            let restCreditId = null;
            try {
                const [pendingCredits] = await db.query(
                    `SELECT id, remaining_amount, credit_type FROM rest_credits
                     WHERE student_id = ?
                     AND academy_id = ?
                     AND credit_type IN ('carryover', 'excused', 'manual')
                     AND status IN ('pending', 'partial')
                     AND remaining_amount > 0
                     ORDER BY created_at ASC`,
                    [student.id, req.user.academyId]
                );

                if (pendingCredits.length > 0) {
                    const credit = pendingCredits[0];
                    const amountBeforeCarryover = baseAmount - discount + additionalAmount;

                    // 이월 금액이 청구 금액보다 크면 청구 금액만큼만 차감
                    carryoverAmount = Math.min(credit.remaining_amount, amountBeforeCarryover);
                    restCreditId = credit.id;

                    // 크레딧 잔액 업데이트
                    const newRemaining = credit.remaining_amount - carryoverAmount;
                    const newStatus = newRemaining <= 0 ? 'applied' : 'partial';

                    await db.query(
                        `UPDATE rest_credits SET
                            remaining_amount = ?,
                            status = ?,
                            processed_at = NOW()
                         WHERE id = ?`,
                        [newRemaining, newStatus, credit.id]
                    );

                    notes = (notes || '') + `\n[이월 차감] 휴식 크레딧 ${carryoverAmount.toLocaleString()}원 차감`;
                    description += ' (이월 차감 적용)';
                    withCarryover++;
                }
            } catch (err) {
                logger.error(`Failed to apply carryover credit for student ${student.id}:`, err);
            }

            const finalAmount = truncateToThousands(baseAmount - discount + additionalAmount - carryoverAmount);

            // 해당 학생의 기존 학원비 확인
            const [existingPayment] = await db.query(
                `SELECT id, payment_status, paid_amount FROM student_payments
                 WHERE student_id = ? AND academy_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'`,
                [student.id, req.user.academyId, yearMonth]
            );

            if (existingPayment.length > 0) {
                const existing = existingPayment[0];

                // 이미 납부 완료된 건은 건너뛰기
                if (existing.payment_status === 'paid') {
                    skipped++;
                    continue;
                }

                // 기존 학원비 업데이트 (금액 변경사항 반영)
                await db.query(
                    `UPDATE student_payments SET
                        base_amount = ?,
                        discount_amount = ?,
                        additional_amount = ?,
                        carryover_amount = ?,
                        rest_credit_id = ?,
                        final_amount = ?,
                        due_date = ?,
                        description = ?,
                        notes = ?,
                        updated_at = NOW()
                     WHERE id = ?`,
                    [
                        baseAmount,
                        discount,
                        additionalAmount,
                        carryoverAmount,
                        restCreditId,
                        finalAmount,
                        due_date,
                        description,
                        notes,
                        existing.id
                    ]
                );
                updated++;
            } else {
                // 새로 생성
                await db.query(
                    `INSERT INTO student_payments (
                        student_id,
                        academy_id,
                        \`year_month\`,
                        payment_type,
                        base_amount,
                        discount_amount,
                        additional_amount,
                        carryover_amount,
                        rest_credit_id,
                        final_amount,
                        due_date,
                        payment_status,
                        description,
                        notes,
                        recorded_by
                    ) VALUES (?, ?, ?, 'monthly', ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
                    [
                        student.id,
                        req.user.academyId,
                        yearMonth,
                        baseAmount,
                        discount,
                        additionalAmount,
                        carryoverAmount,
                        restCreditId,
                        finalAmount,
                        due_date,
                        description,
                        notes,
                        req.user.userId
                    ]
                );
                created++;
            }
        }

        // 결과 메시지 생성
        const messageParts = [];
        if (created > 0) messageParts.push(`${created}명 생성`);
        if (updated > 0) messageParts.push(`${updated}명 업데이트`);
        if (skipped > 0) messageParts.push(`${skipped}명 건너뜀(납부완료)`);

        let message = messageParts.length > 0
            ? `학원비 처리 완료: ${messageParts.join(', ')}`
            : '처리할 학원비가 없습니다.';

        if (withNonSeasonProrated > 0) message += ` (비시즌 종강 일할 포함: ${withNonSeasonProrated}명)`;
        if (withCarryover > 0) message += ` (이월 차감 적용: ${withCarryover}명)`;

        res.json({
            message,
            created,
            updated,
            skipped,
            withNonSeasonProrated,
            withCarryover,
            year,
            month,
            due_date
        });
    } catch (error) {
        logger.error('Error creating bulk monthly charges:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학원비 일괄 생성에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/payments/:id/pay
 * Record payment (full or partial)
 * Access: owner, admin
 */
router.post('/:id/pay', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const paymentId = parseInt(req.params.id);

    try {
        const { paid_amount, payment_method, payment_date, notes, discount_amount } = req.body;

        if (paid_amount === undefined || paid_amount === null || !payment_method) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '필수 항목을 모두 입력해주세요. (납부금액, 결제방법)'
            });
        }

        // Get payment record
        const [payments] = await db.query(
            `SELECT p.*
            FROM student_payments p
            WHERE p.id = ? AND p.academy_id = ?`,
            [paymentId, req.user.academyId]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '납부 내역을 찾을 수 없습니다.'
            });
        }

        const payment = payments[0];

        // Check if payment already completed
        if (payment.payment_status === 'paid') {
            return res.status(400).json({
                error: 'Validation Error',
                message: '이미 완납된 내역입니다.'
            });
        }

        // 추가 할인 적용 시 final_amount 감소
        let additionalDiscount = 0;
        let newFinalAmount = parseFloat(payment.final_amount);
        let newDiscountAmount = parseFloat(payment.discount_amount) || 0;

        if (discount_amount && parseFloat(discount_amount) > 0) {
            additionalDiscount = parseFloat(discount_amount);
            newFinalAmount = Math.max(0, newFinalAmount - additionalDiscount);
            newDiscountAmount += additionalDiscount;
        }

        // Calculate amounts
        const totalDue = newFinalAmount;
        const currentPaidAmount = parseFloat(payment.paid_amount) || 0;
        const newPaidAmount = currentPaidAmount + parseFloat(paid_amount);

        // 0원 청구 건은 0원으로 납부 처리 허용 (100% 할인 등)
        if (parseFloat(paid_amount) < 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '납부 금액은 0원 이상이어야 합니다.'
            });
        }

        // 0원이 아닌데 0원 납부하려는 경우만 차단
        if (parseFloat(paid_amount) === 0 && totalDue > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '납부 금액은 0원보다 커야 합니다.'
            });
        }

        // Determine payment status based on total paid amount
        let paymentStatus;
        if (newPaidAmount >= totalDue) {
            paymentStatus = 'paid';
        } else {
            paymentStatus = 'partial';
        }

        // 할인 적용 시 notes에 기록
        let paymentNote = notes || `납부: ${paid_amount}원`;
        if (additionalDiscount > 0) {
            paymentNote = `납부: ${paid_amount}원 (할인 ${additionalDiscount}원 적용)`;
        }

        await db.query(
            `UPDATE student_payments
            SET
                paid_amount = ?,
                final_amount = ?,
                discount_amount = ?,
                payment_status = ?,
                payment_method = ?,
                paid_date = ?,
                notes = CONCAT(IFNULL(notes, ''), '\n', ?),
                updated_at = NOW()
            WHERE id = ?`,
            [
                newPaidAmount,
                newFinalAmount,
                newDiscountAmount,
                paymentStatus,
                payment_method,
                payment_date || new Date().toISOString().split('T')[0],
                paymentNote,
                paymentId
            ]
        );

        // Record in revenues table (optional - table may not exist)
        // payment_type에 따라 적절한 카테고리와 설명 사용
        const revenueCategory = payment.payment_type === 'season' ? 'season' : 'tuition';
        const revenueDescription = payment.payment_type === 'season'
            ? `시즌비 납부 (${payment.description || ''})`.trim()
            : `수강료 납부 (결제ID: ${paymentId})`;

        try {
            await db.query(
                `INSERT INTO revenues (
                    academy_id,
                    category,
                    amount,
                    revenue_date,
                    payment_method,
                    student_id,
                    description
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    payment.academy_id,
                    revenueCategory,
                    paid_amount,
                    payment_date || new Date().toISOString().split('T')[0],
                    payment_method,
                    payment.student_id,
                    revenueDescription
                ]
            );
        } catch (revenueError) {
            logger.info('Revenue table insert skipped:', revenueError.message);
        }

        // Fetch updated payment
        const [updated] = await db.query(
            `SELECT
                p.*,
                s.name as student_name,
                s.student_number
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [paymentId]
        );

        res.json({
            message: '납부가 기록되었습니다.',
            payment: decryptStudentName(updated[0])
        });
    } catch (error) {
        logger.error('=== Error recording payment ===');
        logger.error('Error:', error);
        logger.error('Error message:', error.message);
        logger.error('SQL State:', error.sqlState);
        logger.error('SQL Message:', error.sqlMessage);
        logger.error('Payment ID:', paymentId);
        logger.error('Request body:', req.body);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 기록에 실패했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
        });
    }
});

/**
 * PUT /paca/payments/:id
 * Update payment record
 * Access: owner, admin
 */
router.put('/:id', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const paymentId = parseInt(req.params.id);

    try {
        // Verify payment exists and belongs to this academy
        const [payments] = await db.query(
            `SELECT p.id, s.academy_id
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [paymentId]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '납부 내역을 찾을 수 없습니다.'
            });
        }

        if (payments[0].academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '접근 권한이 없습니다.'
            });
        }

        const {
            payment_type,
            base_amount,
            discount_amount,
            additional_amount,
            due_date,
            paid_date,
            paid_amount,
            payment_method,
            payment_status,
            description,
            notes
        } = req.body;

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (payment_type !== undefined) {
            updates.push('payment_type = ?');
            params.push(payment_type);
        }
        if (base_amount !== undefined) {
            updates.push('base_amount = ?');
            params.push(base_amount);
        }
        if (discount_amount !== undefined) {
            updates.push('discount_amount = ?');
            params.push(discount_amount);
        }
        if (additional_amount !== undefined) {
            updates.push('additional_amount = ?');
            params.push(additional_amount);
        }

        // Recalculate final_amount if any amount fields changed
        if (base_amount !== undefined || discount_amount !== undefined || additional_amount !== undefined) {
            const [current] = await db.query('SELECT base_amount, discount_amount, additional_amount FROM student_payments WHERE id = ?', [paymentId]);
            const currentData = current[0];

            const newBase = base_amount !== undefined ? base_amount : currentData.base_amount;
            const newDiscount = discount_amount !== undefined ? discount_amount : currentData.discount_amount;
            const newAdditional = additional_amount !== undefined ? additional_amount : currentData.additional_amount;

            const finalAmount = truncateToThousands(
                parseFloat(newBase) - parseFloat(newDiscount) + parseFloat(newAdditional)
            );
            updates.push('final_amount = ?');
            params.push(finalAmount);
        }

        if (due_date !== undefined) {
            updates.push('due_date = ?');
            params.push(due_date);
        }
        if (paid_date !== undefined) {
            updates.push('paid_date = ?');
            params.push(paid_date);
        }
        if (paid_amount !== undefined) {
            updates.push('paid_amount = ?');
            params.push(paid_amount);
        }
        if (payment_method !== undefined) {
            updates.push('payment_method = ?');
            params.push(payment_method);
        }
        if (payment_status !== undefined) {
            updates.push('payment_status = ?');
            params.push(payment_status);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '수정할 항목이 없습니다.'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(paymentId);

        await db.query(
            `UPDATE student_payments SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        // Fetch updated payment
        const [updated] = await db.query(
            `SELECT
                p.*,
                s.name as student_name,
                s.student_number
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [paymentId]
        );

        res.json({
            message: '납부 내역이 수정되었습니다.',
            payment: decryptStudentName(updated[0])
        });
    } catch (error) {
        logger.error('Error updating payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역 수정에 실패했습니다.'
        });
    }
});

/**
 * DELETE /paca/payments/:id
 * Delete payment record
 * Access: owner only
 */
router.delete('/:id', verifyToken, requireRole('owner'), async (req, res) => {
    const paymentId = parseInt(req.params.id);

    try {
        // Verify payment exists and belongs to this academy
        const [payments] = await db.query(
            `SELECT p.id, p.student_id, s.name as student_name
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ? AND p.academy_id = ?`,
            [paymentId, req.user.academyId]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '납부 내역을 찾을 수 없습니다.'
            });
        }

        // Delete payment record
        await db.query('DELETE FROM student_payments WHERE id = ?', [paymentId]);

        res.json({
            message: '납부 내역이 삭제되었습니다.',
            payment: {
                id: paymentId,
                student_name: payments[0].student_name
            }
        });
    } catch (error) {
        logger.error('Error deleting payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역 삭제에 실패했습니다.'
        });
    }
});

/**
 * GET /paca/payments/stats/summary
 * Get payment statistics summary
 * Access: owner, admin
 */
router.get('/stats/summary', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        const { year, month } = req.query;

        let dateFilter = '';
        const params = [req.user.academyId];

        if (year && month) {
            dateFilter = ` AND p.year_month = ?`;
            params.push(`${year}-${String(month).padStart(2, '0')}`);
        }

        // Get payment statistics
        const [stats] = await db.query(
            `SELECT
                COUNT(*) as total_count,
                SUM(CASE WHEN p.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN p.payment_status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                SUM(CASE WHEN p.payment_status = 'pending' THEN 1 ELSE 0 END) as unpaid_count,
                SUM(p.final_amount) as total_expected,
                SUM(CASE WHEN p.payment_status = 'paid' THEN p.final_amount ELSE 0 END) as total_collected,
                SUM(CASE WHEN p.payment_status IN ('pending', 'partial') THEN p.final_amount ELSE 0 END) as total_outstanding
            FROM student_payments p
            WHERE p.academy_id = ?${dateFilter}`,
            params
        );

        res.json({
            message: '납부 통계를 불러왔습니다.',
            stats: stats[0]
        });
    } catch (error) {
        logger.error('Error fetching payment stats:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 통계를 불러오는데 실패했습니다.'
        });
    }
});

/**
 * POST /paca/payments/generate-prorated
 * Generate prorated payment for a student based on enrollment date
 * Access: owner, admin
 *
 * 등록일 기준 일할계산:
 * - 11/25 등록, 납부일 1일 → 11월: 25~30일 일할, 12월부터: 정상
 */
router.post('/generate-prorated', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    try {
        const { student_id, enrollment_date } = req.body;

        if (!student_id) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '학생을 선택해주세요.'
            });
        }

        // Get student with payment_due_day
        const [students] = await db.query(
            `SELECT
                s.id, s.name, s.monthly_tuition, s.discount_rate,
                s.payment_due_day, s.enrollment_date, s.class_days,
                a.tuition_due_day
            FROM students s
            JOIN academies ac ON s.academy_id = ac.id
            LEFT JOIN academy_settings a ON ac.id = a.academy_id
            WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생을 찾을 수 없습니다.'
            });
        }

        const student = students[0];
        const regDate = new Date(enrollment_date || student.enrollment_date || new Date());

        // 납부일 결정: 학생 개별 납부일 > 학원 납부일 > 기본 5일
        const dueDay = student.payment_due_day || student.tuition_due_day || 5;

        // 등록월의 마지막 날
        const lastDayOfMonth = new Date(regDate.getFullYear(), regDate.getMonth() + 1, 0).getDate();
        const regDay = regDate.getDate();

        // 수업 요일 파싱
        let classDays = [];
        try {
            classDays = typeof student.class_days === 'string'
                ? JSON.parse(student.class_days)
                : (student.class_days || []);
        } catch (e) {
            classDays = [];
        }

        // 해당 월의 총 수업일수 계산
        const dayNameToNum = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };
        const classDayNums = classDays.map(d => dayNameToNum[d]).filter(d => d !== undefined);

        let totalClassDays = 0;
        let remainingClassDays = 0;

        for (let day = 1; day <= lastDayOfMonth; day++) {
            const date = new Date(regDate.getFullYear(), regDate.getMonth(), day);
            const dayOfWeek = date.getDay();
            if (classDayNums.includes(dayOfWeek)) {
                totalClassDays++;
                if (day >= regDay) {
                    remainingClassDays++;
                }
            }
        }

        // 일할계산 금액
        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const discountRate = parseFloat(student.discount_rate) || 0;
        const discountAmount = baseAmount * (discountRate / 100);

        let proRatedAmount = baseAmount;
        let isProrated = false;

        // 등록일이 1일이 아니면 일할계산
        if (regDay > 1 && totalClassDays > 0) {
            proRatedAmount = truncateToThousands(baseAmount * (remainingClassDays / totalClassDays));
            isProrated = true;
        }

        const finalAmount = truncateToThousands(proRatedAmount - (proRatedAmount * (discountRate / 100)));

        // 납부기한 계산 (등록월의 납부일 또는 등록일 + 7일)
        let dueDate;
        if (regDay <= dueDay) {
            // 등록일이 납부일 전이면 이번 달 납부일
            dueDate = new Date(regDate.getFullYear(), regDate.getMonth(), dueDay);
        } else {
            // 등록일이 납부일 후면 등록일 + 7일 (또는 다음달 납부일)
            dueDate = new Date(regDate);
            dueDate.setDate(regDate.getDate() + 7);
        }

        const yearMonth = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}`;

        // 이미 해당 월 납부건이 있는지 확인
        const [existing] = await db.query(
            `SELECT id FROM student_payments
            WHERE student_id = ? AND year_month = ? AND payment_type = 'monthly'`,
            [student_id, yearMonth]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: `${yearMonth} 월 납부건이 이미 존재합니다.`
            });
        }

        // 납부 레코드 생성
        const prorationDetails = {
            enrollment_date: regDate.toISOString().split('T')[0],
            registration_day: regDay,
            total_class_days: totalClassDays,
            remaining_class_days: remainingClassDays,
            class_days: classDays,
            base_amount: baseAmount,
            prorated_amount: proRatedAmount,
            calculation: isProrated
                ? `${baseAmount}원 × (${remainingClassDays}/${totalClassDays}일) = ${proRatedAmount}원`
                : '일할계산 없음 (월초 등록)'
        };

        const [result] = await db.query(
            `INSERT INTO student_payments (
                student_id, academy_id, year_month, payment_type,
                base_amount, discount_amount, additional_amount, final_amount,
                is_prorated, proration_details,
                due_date, payment_status, description, recorded_by
            ) VALUES (?, ?, ?, 'monthly', ?, ?, 0, ?, ?, ?, ?, 'pending', ?, ?)`,
            [
                student_id,
                req.user.academyId,
                yearMonth,
                proRatedAmount,
                proRatedAmount * (discountRate / 100),
                finalAmount,
                isProrated ? 1 : 0,
                JSON.stringify(prorationDetails),
                dueDate.toISOString().split('T')[0],
                isProrated
                    ? `${regDate.getMonth() + 1}월 학원비 (일할: ${regDay}일~)`
                    : `${regDate.getMonth() + 1}월 학원비`,
                req.user.userId
            ]
        );

        // 생성된 납부건 조회
        const [created] = await db.query(
            `SELECT p.*, s.name as student_name
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            message: '일할계산 납부건이 생성되었습니다.',
            payment: created[0],
            proration: prorationDetails
        });
    } catch (error) {
        logger.error('Error generating prorated payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '일할계산 납부건 생성에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/payments/generate-monthly-for-student
 * Generate next month's payment for a specific student
 * Access: owner, admin
 */
router.post('/generate-monthly-for-student', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    try {
        const { student_id, year, month } = req.body;

        if (!student_id || !year || !month) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '필수 항목을 모두 입력해주세요. (학생, 연도, 월)'
            });
        }

        // Get student info
        const [students] = await db.query(
            `SELECT
                s.id, s.name, s.monthly_tuition, s.discount_rate,
                s.payment_due_day,
                a.tuition_due_day
            FROM students s
            JOIN academies ac ON s.academy_id = ac.id
            LEFT JOIN academy_settings a ON ac.id = a.academy_id
            WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생을 찾을 수 없습니다.'
            });
        }

        const student = students[0];
        const dueDay = student.payment_due_day || student.tuition_due_day || 5;
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

        // Check existing
        const [existing] = await db.query(
            `SELECT id FROM student_payments
            WHERE student_id = ? AND year_month = ? AND payment_type = 'monthly'`,
            [student_id, yearMonth]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: `${yearMonth} 월 납부건이 이미 존재합니다.`
            });
        }

        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const discountRate = parseFloat(student.discount_rate) || 0;
        const discountAmount = truncateToThousands(baseAmount * (discountRate / 100));

        // 비시즌 종강 일할 계산
        let additionalAmount = 0;
        let notes = null;
        let description = `${year}년 ${month}월 학원비`;
        let nonSeasonProratedInfo = null;

        try {
            const nonSeasonProrated = await calculateNonSeasonEndProrated({
                studentId: student_id,
                academyId: req.user.academyId,
                year,
                month
            });

            if (nonSeasonProrated) {
                additionalAmount = nonSeasonProrated.amount;
                notes = `[비시즌 종강 일할] ${nonSeasonProrated.description}\n${nonSeasonProrated.details.formula}`;
                description = `${year}년 ${month}월 학원비 + 비시즌 종강 일할`;
                nonSeasonProratedInfo = nonSeasonProrated;
            }
        } catch (err) {
            logger.error(`Failed to calculate non-season prorated for student ${student_id}:`, err);
        }

        const finalAmount = truncateToThousands(baseAmount - discountAmount + additionalAmount);

        // Due date
        const dueDate = new Date(year, month - 1, dueDay);

        const [result] = await db.query(
            `INSERT INTO student_payments (
                student_id, academy_id, year_month, payment_type,
                base_amount, discount_amount, additional_amount, final_amount,
                due_date, payment_status, description, notes, recorded_by
            ) VALUES (?, ?, ?, 'monthly', ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
            [
                student_id,
                req.user.academyId,
                yearMonth,
                baseAmount,
                discountAmount,
                additionalAmount,
                finalAmount,
                dueDate.toISOString().split('T')[0],
                description,
                notes,
                req.user.userId
            ]
        );

        const [created] = await db.query(
            `SELECT p.*, s.name as student_name
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            message: nonSeasonProratedInfo
                ? '월 납부건이 생성되었습니다. (비시즌 종강 일할 포함)'
                : '월 납부건이 생성되었습니다.',
            payment: created[0],
            nonSeasonProrated: nonSeasonProratedInfo
        });
    } catch (error) {
        logger.error('Error generating monthly payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '월 납부건 생성에 실패했습니다.'
        });
    }
});

// ====== 선납 할인 결제 ======

// POST /paca/payments/prepaid-preview - 선납 미리보기 (금액 계산)
router.post('/prepaid-preview', verifyToken, async (req, res) => {
    try {
        const { student_id, months, prepaid_discount_rate } = req.body;

        // Validation
        if (!student_id || !Array.isArray(months) || months.length < 2 || months.length > 6) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '학생 ID와 2~6개월 범위의 월 목록이 필요합니다.'
            });
        }

        const rate = parseFloat(prepaid_discount_rate);
        if (isNaN(rate) || rate < 0 || rate > 50) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '선납 할인율은 0~50% 범위여야 합니다.'
            });
        }

        // 학생 조회
        const [students] = await db.query(
            `SELECT s.id, s.name, s.monthly_tuition, s.discount_rate, s.payment_due_day, s.status,
                    a.tuition_due_day
             FROM students s
             LEFT JOIN academy_settings a ON s.academy_id = a.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: '학생을 찾을 수 없습니다.' });
        }

        const student = students[0];
        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const studentDiscountRate = parseFloat(student.discount_rate) || 0;

        // 각 월별 계산
        const monthDetails = [];
        let totalFinal = 0;
        let totalPrepaidDiscount = 0;
        let monthsPayable = 0;
        let monthsAlreadyPaid = 0;

        for (const yearMonth of months) {
            // 기존 결제 레코드 확인
            const [existing] = await db.query(
                'SELECT id, payment_status, paid_amount, final_amount FROM student_payments WHERE student_id = ? AND `year_month` = ? AND payment_type = ?',
                [student_id, yearMonth, 'monthly']
            );

            let status = 'new';
            if (existing.length > 0) {
                const ex = existing[0];
                if (ex.payment_status === 'paid') {
                    status = 'already_paid';
                } else {
                    status = 'existing_unpaid';
                }
            }

            const studentDiscount = truncateToThousands(baseAmount * studentDiscountRate / 100);
            const afterStudentDiscount = baseAmount - studentDiscount;
            const prepaidDiscount = truncateToThousands(afterStudentDiscount * rate / 100);
            const finalAmount = afterStudentDiscount - prepaidDiscount;

            const detail = {
                year_month: yearMonth,
                base_amount: baseAmount,
                student_discount: studentDiscount,
                prepaid_discount: status === 'already_paid' ? 0 : prepaidDiscount,
                final_amount: status === 'already_paid' ? 0 : finalAmount,
                status
            };

            monthDetails.push(detail);

            if (status !== 'already_paid') {
                totalFinal += finalAmount;
                totalPrepaidDiscount += prepaidDiscount;
                monthsPayable++;
            } else {
                monthsAlreadyPaid++;
            }
        }

        res.json({
            student_name: decrypt(student.name),
            monthly_tuition: baseAmount,
            student_discount_rate: studentDiscountRate,
            prepaid_discount_rate: rate,
            months: monthDetails,
            total_final: totalFinal,
            total_prepaid_discount: totalPrepaidDiscount,
            months_payable: monthsPayable,
            months_already_paid: monthsAlreadyPaid
        });
    } catch (error) {
        logger.error('Error in prepaid preview:', error);
        res.status(500).json({ error: 'Server Error', message: '선납 미리보기에 실패했습니다.' });
    }
});

// POST /paca/payments/prepaid-pay - 선납 결제 실행
router.post('/prepaid-pay', verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { student_id, months, prepaid_discount_rate, payment_method, payment_date } = req.body;

        // Validation
        if (!student_id || !Array.isArray(months) || months.length < 2 || months.length > 6) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '학생 ID와 2~6개월 범위의 월 목록이 필요합니다.'
            });
        }

        const rate = parseFloat(prepaid_discount_rate);
        if (isNaN(rate) || rate < 0 || rate > 50) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '선납 할인율은 0~50% 범위여야 합니다.'
            });
        }

        if (!payment_method || !['account', 'card', 'cash', 'other'].includes(payment_method)) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 납부 방법을 선택해주세요.'
            });
        }

        const payDate = payment_date || new Date().toISOString().split('T')[0];

        await connection.beginTransaction();

        // 학생 조회
        const [students] = await connection.query(
            `SELECT s.id, s.name, s.monthly_tuition, s.discount_rate, s.payment_due_day, s.status, s.academy_id,
                    a.tuition_due_day
             FROM students s
             LEFT JOIN academy_settings a ON s.academy_id = a.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Not Found', message: '학생을 찾을 수 없습니다.' });
        }

        const student = students[0];
        if (student.status !== 'active') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'Validation Error', message: '재원 중인 학생만 선납 결제가 가능합니다.' });
        }

        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const studentDiscountRate = parseFloat(student.discount_rate) || 0;
        const dueDay = student.payment_due_day || student.tuition_due_day || 5;
        const crypto = require('crypto');
        const prepaidGroupId = crypto.randomUUID();

        const monthsProcessed = [];
        const monthsSkipped = [];
        let totalAmount = 0;
        let totalDiscount = 0;

        for (const yearMonth of months) {
            // 기존 레코드 SELECT FOR UPDATE
            const [existing] = await connection.query(
                'SELECT id, payment_status, paid_amount, final_amount FROM student_payments WHERE student_id = ? AND `year_month` = ? AND payment_type = ? FOR UPDATE',
                [student_id, yearMonth, 'monthly']
            );

            // 이미 완납이면 skip
            if (existing.length > 0 && existing[0].payment_status === 'paid') {
                monthsSkipped.push(yearMonth);
                continue;
            }

            // 금액 계산
            const studentDiscount = truncateToThousands(baseAmount * studentDiscountRate / 100);
            const afterStudentDiscount = baseAmount - studentDiscount;
            const prepaidDiscount = truncateToThousands(afterStudentDiscount * rate / 100);
            const finalAmount = afterStudentDiscount - prepaidDiscount;
            const totalDiscountAmount = studentDiscount + prepaidDiscount;

            const [year, month] = yearMonth.split('-').map(Number);
            const dueDateStr = new Date(year, month - 1, dueDay).toISOString().split('T')[0];
            const prepaidNote = `[선납 ${months.length}개월] ${rate}% 할인 (${prepaidDiscount.toLocaleString()}원)`;

            if (existing.length === 0) {
                // INSERT 새 레코드 (paid 상태로)
                await connection.query(
                    `INSERT INTO student_payments (
                        student_id, academy_id, \`year_month\`, payment_type,
                        base_amount, discount_amount, additional_amount, final_amount,
                        paid_amount, paid_date, due_date,
                        payment_status, payment_method, description, notes,
                        recorded_by, prepaid_group_id
                    ) VALUES (?, ?, ?, 'monthly', ?, ?, 0, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)`,
                    [
                        student_id,
                        req.user.academyId,
                        yearMonth,
                        baseAmount,
                        totalDiscountAmount,
                        finalAmount,
                        finalAmount,
                        payDate,
                        dueDateStr,
                        payment_method,
                        `${year}년 ${month}월 학원비`,
                        prepaidNote,
                        req.user.userId,
                        prepaidGroupId
                    ]
                );
            } else {
                // UPDATE 기존 미납 레코드
                await connection.query(
                    `UPDATE student_payments SET
                        base_amount = ?, discount_amount = ?, final_amount = ?,
                        paid_amount = ?, paid_date = ?,
                        payment_status = 'paid', payment_method = ?,
                        notes = CONCAT(IFNULL(notes, ''), '\n', ?),
                        prepaid_group_id = ?,
                        updated_at = NOW()
                     WHERE id = ?`,
                    [
                        baseAmount,
                        totalDiscountAmount,
                        finalAmount,
                        finalAmount,
                        payDate,
                        payment_method,
                        prepaidNote,
                        prepaidGroupId,
                        existing[0].id
                    ]
                );
            }

            // revenues 테이블 INSERT
            try {
                await connection.query(
                    `INSERT INTO revenues (
                        academy_id, category, amount, revenue_date,
                        payment_method, student_id, description
                    ) VALUES (?, 'tuition', ?, ?, ?, ?, ?)`,
                    [
                        req.user.academyId,
                        finalAmount,
                        payDate,
                        payment_method,
                        student_id,
                        `선납 결제 - ${yearMonth} (${months.length}개월)`
                    ]
                );
            } catch (revenueError) {
                logger.info('Revenue table insert skipped:', revenueError.message);
            }

            monthsProcessed.push(yearMonth);
            totalAmount += finalAmount;
            totalDiscount += prepaidDiscount;
        }

        await connection.commit();
        connection.release();

        res.json({
            message: `선납 결제가 완료되었습니다. (${monthsProcessed.length}개월)`,
            prepaid_group_id: prepaidGroupId,
            total_amount: totalAmount,
            total_discount: totalDiscount,
            months_processed: monthsProcessed,
            months_skipped: monthsSkipped
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        logger.error('Error in prepaid pay:', error);
        res.status(500).json({ error: 'Server Error', message: '선납 결제에 실패했습니다.' });
    }
});

module.exports = router;
