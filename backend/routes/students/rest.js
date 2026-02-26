const db = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { autoAssignStudentToSchedules } = require('./_utils');

module.exports = function(router) {

/**
 * POST /paca/students/:id/process-rest
 * 학생 휴식 처리 (이월/환불 크레딧 생성 + 미납금 조정)
 * Access: owner, admin
 */
router.post('/:id/process-rest', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. 학생 존재 확인 및 현재 정보 조회
        const [students] = await connection.query(
            `SELECT id, name, monthly_tuition, discount_rate, status, academy_id
             FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        const student = students[0];

        const {
            rest_start_date,
            rest_end_date,
            rest_reason,
            credit_type,  // 'carryover' | 'refund' | 'none'
            source_payment_id  // 이미 납부한 학원비 ID (선택)
        } = req.body;

        // 2. 필수 필드 검증
        if (!rest_start_date) {
            await connection.rollback();
            return res.status(400).json({
                error: 'Validation Error',
                message: '휴식 시작일은 필수입니다.'
            });
        }

        // 3. 학생 상태를 paused로 변경하고 휴식 정보 저장
        await connection.query(
            `UPDATE students SET
                status = 'paused',
                rest_start_date = ?,
                rest_end_date = ?,
                rest_reason = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [rest_start_date, rest_end_date || null, rest_reason || null, studentId]
        );

        // 3-1. 휴원 시작월 미납금 조정
        let unpaidAdjustment = null;
        {
            const restStartDate = new Date(rest_start_date);
            const unpaidYear = restStartDate.getFullYear();
            const unpaidMonth = restStartDate.getMonth() + 1;
            const yearMonth = `${unpaidYear}-${String(unpaidMonth).padStart(2, '0')}`;
            const dayOfMonth = restStartDate.getDate();

            // 해당 월 미납 학원비 조회
            const [unpaidPayments] = await connection.query(
                `SELECT id, base_amount, discount_amount, final_amount, paid_amount, payment_status
                 FROM student_payments
                 WHERE student_id = ? AND academy_id = ? AND \`year_month\` = ?
                 AND payment_status IN ('pending', 'partial', 'overdue')`,
                [studentId, req.user.academyId, yearMonth]
            );

            if (unpaidPayments.length > 0) {
                const payment = unpaidPayments[0];
                const originalAmount = parseFloat(payment.final_amount);
                const paidAmount = parseFloat(payment.paid_amount) || 0;

                if (dayOfMonth === 1) {
                    // 1일자 휴원이면 해당 월 학원비 삭제
                    await connection.query(
                        'DELETE FROM student_payments WHERE id = ?',
                        [payment.id]
                    );
                    unpaidAdjustment = {
                        action: 'deleted',
                        originalAmount,
                        adjustedAmount: 0,
                        message: `${yearMonth} 미납 학원비 삭제 (1일자 휴원)`
                    };
                } else {
                    // 중간에 휴원이면 휴원 전날까지 일할계산
                    const unpaidDaysInMonth = new Date(unpaidYear, unpaidMonth, 0).getDate();
                    const attendedDays = dayOfMonth - 1;  // 휴원 시작일 전날까지

                    // 일할계산 (천원 단위 절삭)
                    const adjustedAmount = Math.floor((originalAmount * attendedDays / unpaidDaysInMonth) / 1000) * 1000;

                    // 이미 납부한 금액보다 조정 금액이 적으면 조정 금액을 납부 금액으로
                    const finalAdjustedAmount = Math.max(adjustedAmount, paidAmount);

                    // 금액 조정
                    await connection.query(
                        `UPDATE student_payments SET
                            final_amount = ?,
                            payment_status = CASE WHEN ? <= ? THEN 'paid' ELSE payment_status END,
                            updated_at = NOW()
                         WHERE id = ?`,
                        [finalAdjustedAmount, finalAdjustedAmount, paidAmount, payment.id]
                    );

                    unpaidAdjustment = {
                        action: 'adjusted',
                        originalAmount,
                        adjustedAmount: finalAdjustedAmount,
                        attendedDays,
                        daysInMonth: unpaidDaysInMonth,
                        message: `${yearMonth} 학원비 조정: ${originalAmount.toLocaleString()}원 → ${finalAdjustedAmount.toLocaleString()}원 (${attendedDays}일분)`
                    };
                }
            }
        }

        let restCredit = null;

        // 4. 이월/환불 크레딧 처리
        if (credit_type && credit_type !== 'none') {
            // 휴식 기간 계산
            const startDate = new Date(rest_start_date);
            let endDate;

            if (rest_end_date) {
                endDate = new Date(rest_end_date);
            } else {
                // 무기한인 경우 해당 월 말일까지로 계산
                endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            }

            // 해당 월 내 휴식 일수 계산
            const year = startDate.getFullYear();
            const month = startDate.getMonth();
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0);
            const daysInMonth = monthEnd.getDate();

            const effectiveStart = startDate > monthStart ? startDate : monthStart;
            const effectiveEnd = endDate < monthEnd ? endDate : monthEnd;
            const restDays = Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;

            // 일할 금액 계산
            const monthlyTuition = parseFloat(student.monthly_tuition) || 0;
            const dailyRate = monthlyTuition / daysInMonth;
            const creditAmount = Math.floor((dailyRate * restDays) / 1000) * 1000;  // 천원 단위 절삭

            if (creditAmount > 0) {
                // 휴식 크레딧 생성
                const [creditResult] = await connection.query(
                    `INSERT INTO rest_credits (
                        student_id,
                        academy_id,
                        source_payment_id,
                        rest_start_date,
                        rest_end_date,
                        rest_days,
                        credit_amount,
                        remaining_amount,
                        credit_type,
                        status,
                        notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                    [
                        studentId,
                        req.user.academyId,
                        source_payment_id || null,
                        rest_start_date,
                        rest_end_date || effectiveEnd.toISOString().split('T')[0],
                        restDays,
                        creditAmount,
                        creditAmount,  // remaining_amount = credit_amount 초기값
                        credit_type,
                        `휴식 기간: ${rest_start_date} ~ ${rest_end_date || '무기한'}, 사유: ${rest_reason || '없음'}`
                    ]
                );

                const [credits] = await connection.query(
                    'SELECT * FROM rest_credits WHERE id = ?',
                    [creditResult.insertId]
                );
                restCredit = credits[0];
            }
        }

        // 5. 오늘 이후 미출석 스케줄 삭제 (휴식 시작일 기준)
        await connection.query(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
             AND cs.academy_id = ?
             AND cs.class_date >= ?
             AND a.attendance_status IS NULL`,
            [studentId, req.user.academyId, rest_start_date]
        );

        await connection.commit();

        // 업데이트된 학생 정보 조회
        const [updatedStudents] = await db.query(
            'SELECT * FROM students WHERE id = ?',
            [studentId]
        );

        res.json({
            message: '휴식 처리가 완료되었습니다.',
            student: updatedStudents[0],
            restCredit,
            unpaidAdjustment
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error processing rest:', error);
        logger.error('Error processing rest:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to process rest',
            detail: error.message
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /paca/students/:id/resume
 * 학생 휴식 복귀 처리
 * - 복귀 시 해당 월 학원비가 없으면 일할계산하여 자동 생성
 * - resume_date: 복귀 날짜 (YYYY-MM-DD) - 없으면 오늘 날짜 사용
 * Access: owner, admin
 */
router.post('/:id/resume', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { resume_date } = req.body;

    // 복귀 날짜 설정 (없으면 오늘)
    const resumeDate = resume_date ? new Date(resume_date + 'T00:00:00') : new Date();
    const resumeDateStr = resumeDate.toISOString().split('T')[0];

    try {
        // 학생 존재 확인 (수강료 정보 포함)
        const [students] = await db.query(
            `SELECT s.id, s.name, s.status, s.class_days, s.monthly_tuition, s.discount_rate,
                    COALESCE(s.payment_due_day, ast.tuition_due_day, 5) as due_day
             FROM students s
             LEFT JOIN academy_settings ast ON s.academy_id = ast.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        const student = students[0];

        if (student.status !== 'paused') {
            return res.status(400).json({
                error: 'Validation Error',
                message: '휴식 상태인 학생만 복귀할 수 있습니다.'
            });
        }

        // 상태를 active로 변경하고 휴식 정보 초기화
        await db.query(
            `UPDATE students SET
                status = 'active',
                rest_start_date = NULL,
                rest_end_date = NULL,
                rest_reason = NULL,
                updated_at = NOW()
             WHERE id = ?`,
            [studentId]
        );

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
                    db,
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
            const [existingPayment] = await db.query(
                `SELECT id FROM student_payments
                 WHERE student_id = ? AND academy_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'`,
                [studentId, req.user.academyId, yearMonth]
            );

            if (existingPayment.length === 0 && student.monthly_tuition > 0) {
                // 일할계산: 복귀일부터 말일까지
                const lastDayOfMonth = new Date(year, month, 0).getDate();
                const remainingDays = lastDayOfMonth - currentDay + 1;

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

                // 납부기한: 복귀일 + 7일
                const dueDate = new Date(resumeDate);
                dueDate.setDate(dueDate.getDate() + 7);

                const description = `${month}월 학원비 (${currentDay}일 복귀, 일할계산)`;
                const notes = `복귀일: ${currentDay}일, 남은 수업일: ${remainingClassDays}/${totalClassDays}일\n` +
                              `계산: ${baseAmount.toLocaleString()}원 × (${remainingClassDays}/${totalClassDays}) = ${proRatedAmount.toLocaleString()}원`;

                const [result] = await db.query(
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
                        dueDate.toISOString().split('T')[0],
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
        const [updatedStudents] = await db.query(
            'SELECT * FROM students WHERE id = ?',
            [studentId]
        );

        res.json({
            message: paymentCreated
                ? `${resumeDateStr} 복귀 처리가 완료되었습니다. ${paymentCreated.yearMonth} 학원비 ${paymentCreated.finalAmount.toLocaleString()}원이 생성되었습니다.`
                : `${resumeDateStr} 복귀 처리가 완료되었습니다.`,
            student: updatedStudents[0],
            scheduleAssigned: reassignResult,
            paymentCreated,
            resumeDate: resumeDateStr
        });
    } catch (error) {
        logger.error('Error resuming student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to resume student'
        });
    }
});

};
