const pool = require('../../../config/database');
const { verifyToken, checkPermission } = require('../../../middleware/auth');
const logger = require('../../../utils/logger');
const {
    getKoreaDateText,
    resolveProratedPaymentDueDate,
} = require('../../../utils/proratedPaymentDueDate');
const {
    RestCreditRecalculationConflictError,
    RestCreditRecalculationValidationError,
    recalculateRestCreditsOnResume,
} = require('../../../services/restCreditRecalculationService');
const { autoAssignStudentToSchedules } = require('../_utils');

module.exports = function registerResumeRoute(router) {
/**
 * POST /paca/students/:id/resume
 * 학생 휴식 복귀 처리
 *
 * 동작:
 *   - 실제 휴식 종료일(복귀 전날) 기준으로 휴식 크레딧 재계산
 *   - 크레딧과 학생 status 변경을 한 트랜잭션으로 처리
 *   - 학생 status = 'active' 로 변경하고 휴식 정보 (rest_start/end/reason) 초기화
 *   - class_days 가 있으면 복귀일 기준 미래 스케줄 자동 재배정 (autoAssignStudentToSchedules)
 *   - 해당 월 학원비가 없으면 일할계산하여 자동 생성 (수업 요일 기준)
 *
 * Body:
 *   - resume_date (옵션, YYYY-MM-DD — 없으면 오늘)
 *
 * 스케줄 재배정과 학원비 생성은 기존처럼 복귀 완료 후 독립적으로 처리한다.
 * Access: owner, admin
 */
router.post('/:id/resume', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { resume_date } = req.body;

    const resumeDateStr = resume_date || getKoreaDateText();
    const resumeDate = new Date(`${resumeDateStr}T00:00:00`);
    let connection = null;
    let transactionActive = false;
    let student;
    let creditRecalculation = null;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionActive = true;

        // 복귀 상태와 크레딧을 함께 잠가 중복 복귀·중복 재계산을 막는다.
        const [students] = await connection.execute(
            `SELECT s.id, s.academy_id, s.name, s.status, s.class_days,
                    s.monthly_tuition, s.discount_rate, s.rest_start_date, s.rest_end_date,
                    COALESCE(s.payment_due_day, ast.tuition_due_day, 5) as due_day
             FROM students s
             LEFT JOIN academy_settings ast ON s.academy_id = ast.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL
             FOR UPDATE`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            await connection.rollback();
            transactionActive = false;
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: '학생 정보를 찾을 수 없습니다.'
            });
        }

        student = students[0];

        if (student.status !== 'paused') {
            await connection.rollback();
            transactionActive = false;
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '휴식 상태인 학생만 복귀할 수 있습니다.'
            });
        }

        creditRecalculation = await recalculateRestCreditsOnResume({
            connection,
            student,
            resumeDate: resumeDateStr,
        });

        // 상태를 active로 변경하고 휴식 정보 초기화
        await connection.execute(
            `UPDATE students SET
                status = 'active',
                rest_start_date = NULL,
                rest_end_date = NULL,
                rest_reason = NULL,
                updated_at = NOW()
             WHERE id = ? AND academy_id = ?`,
            [studentId, req.user.academyId]
        );

        await connection.commit();
        transactionActive = false;
    } catch (error) {
        if (transactionActive && connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                logger.error('Error rolling back resume transaction:', rollbackError);
            }
        }

        if (error instanceof RestCreditRecalculationConflictError) {
            return res.status(409).json({
                error: 'REST_CREDIT_RECALCULATION_CONFLICT',
                message: error.message,
            });
        }
        if (error instanceof RestCreditRecalculationValidationError) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: error.message,
            });
        }

        logger.error('Error resuming student:', error);
        return res.status(500).json({
            error: 'RESUME_FAILED',
            message: '복귀 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
        });
    } finally {
        if (connection) connection.release();
    }

    try {
        // class_days가 있으면 오늘부터 스케줄 재배정
        const classDays = student.class_days
            ? (typeof student.class_days === 'string'
                ? JSON.parse(student.class_days)
                : student.class_days)
            : [];

        let reassignResult = null;
        if (classDays.length > 0) {
            try {
                reassignResult = await autoAssignStudentToSchedules(
                    pool,
                    studentId,
                    req.user.academyId,
                    classDays,
                    resumeDateStr,  // 복귀 날짜 기준
                    'evening'
                );
            } catch (assignError) {
                logger.error('Auto-assign failed:', assignError);
            }
        }

        // 복귀 시 해당 월 학원비 자동 생성 (일할계산)
        let paymentCreated = null;
        try {
            const year = resumeDate.getFullYear();
            const month = resumeDate.getMonth() + 1;
            const currentDay = resumeDate.getDate();
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

            // 이미 해당 월 학원비가 있는지 확인
            const [existingPayment] = await pool.execute(
                `SELECT id FROM student_payments
                 WHERE student_id = ? AND academy_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'`,
                [studentId, req.user.academyId, yearMonth]
            );

            if (existingPayment.length === 0 && student.monthly_tuition > 0) {
                // 일할계산: 복귀일부터 말일까지
                const lastDayOfMonth = new Date(year, month, 0).getDate();

                // 수업 요일 기준 일할 계산 (숫자/객체/한글 배열 처리)
                let classDayNums = [];
                if (Array.isArray(classDays) && classDays.length > 0) {
                    if (typeof classDays[0] === 'number') {
                        // 숫자 배열 [1, 5] (월=1, 금=5)
                        classDayNums = classDays;
                    } else if (typeof classDays[0] === 'object' && classDays[0].day !== undefined) {
                        // 객체 배열 [{day:1,timeSlot:"morning"}]
                        classDayNums = classDays.map(d => d.day);
                    } else {
                        // 한글 요일 배열 ['월', '금']
                        const dayNameToNum = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };
                        classDayNums = classDays.map(d => dayNameToNum[d]).filter(d => d !== undefined);
                    }
                }

                // 4주 고정: 월 총 수업일 = 주간 횟수 × 4
                const weeklyCount = classDayNums.length || 2;  // 기본값 주2회
                let totalClassDays = weeklyCount * 4;

                // 남은 수업일: 복귀일부터 말일까지 실제 수업요일 카운트
                let remainingClassDays = 0;
                for (let day = currentDay; day <= lastDayOfMonth; day++) {
                    const date = new Date(year, month - 1, day);
                    const dayOfWeek = date.getDay();
                    if (classDayNums.length === 0 || classDayNums.includes(dayOfWeek)) {
                        remainingClassDays++;
                    }
                }
                // 남은 수업일이 총 수업일을 초과하지 않도록 (1일 복귀 시)
                remainingClassDays = Math.min(remainingClassDays, totalClassDays);

                const baseAmount = parseFloat(student.monthly_tuition);
                const discountRate = parseFloat(student.discount_rate) || 0;

                // 일할 금액 계산
                let proRatedAmount = baseAmount;
                if (totalClassDays > 0 && currentDay > 1) {
                    proRatedAmount = Math.floor((baseAmount * remainingClassDays / totalClassDays) / 1000) * 1000;
                }

                const discountAmount = Math.floor((proRatedAmount * discountRate / 100) / 1000) * 1000;
                const finalAmount = proRatedAmount - discountAmount;

                const dueDate = resolveProratedPaymentDueDate(resumeDateStr);

                const description = `${month}월 학원비 (${currentDay}일 복귀, 일할계산)`;
                const notes = `복귀일: ${currentDay}일, 남은 수업일: ${remainingClassDays}/${totalClassDays}일\n` +
                              `계산: ${baseAmount.toLocaleString()}원 × (${remainingClassDays}/${totalClassDays}) = ${proRatedAmount.toLocaleString()}원`;

                const [result] = await pool.execute(
                    `INSERT INTO student_payments (
                        student_id, academy_id, \`year_month\`, payment_type,
                        base_amount, discount_amount, additional_amount, final_amount,
                        is_prorated, due_date, payment_status, description, notes, recorded_by
                    ) VALUES (?, ?, ?, 'monthly', ?, ?, 0, ?, 1, ?, 'pending', ?, ?, ?)`,
                    [
                        studentId,
                        req.user.academyId,
                        yearMonth,
                        proRatedAmount,
                        discountAmount,
                        finalAmount,
                        dueDate,
                        description,
                        notes,
                        req.user.userId
                    ]
                );

                paymentCreated = {
                    id: result.insertId,
                    yearMonth,
                    baseAmount: proRatedAmount,
                    finalAmount,
                    remainingClassDays,
                    totalClassDays
                };
            }
        } catch (paymentError) {
            logger.error('Auto payment creation failed:', paymentError);
        }

        // 업데이트된 학생 정보 조회
        const [updatedStudents] = await pool.execute(
            'SELECT * FROM students WHERE id = ?',
            [studentId]
        );

        const messageParts = [`${resumeDateStr} 복귀 처리가 완료되었습니다.`];
        if (creditRecalculation?.adjusted) {
            messageParts.push(
                `휴식 크레딧이 ${creditRecalculation.previousAmount.toLocaleString()}원에서 `
                + `${creditRecalculation.creditAmount.toLocaleString()}원으로 재계산되었습니다.`
            );
        }
        if (paymentCreated) {
            messageParts.push(
                `${paymentCreated.yearMonth} 학원비 `
                + `${paymentCreated.finalAmount.toLocaleString()}원이 생성되었습니다.`
            );
        }

        res.json({
            message: messageParts.join(' '),
            student: updatedStudents[0],
            scheduleAssigned: reassignResult,
            paymentCreated,
            creditRecalculation,
            resumeDate: resumeDateStr
        });
    } catch (error) {
        logger.error('Error resuming student:', error);
        res.status(500).json({
            error: 'RESUME_FAILED',
            message: '복귀 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
        });
    }
});
};
