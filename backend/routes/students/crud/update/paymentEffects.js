const {
    parseClassDaysWithSlots,
    extractDayNumbers,
    truncateToThousands,
    logger,
} = require('../_utils');
const {
    getKoreaDateText,
    resolveProratedPaymentDueDate,
} = require('../../../../utils/proratedPaymentDueDate');

async function updatePendingPayments(context) {
    const {
        pool,
        studentId,
        academyId,
        monthlyTuition,
        discountRate,
        updatedStudent,
    } = context;
    if (monthlyTuition === undefined && discountRate === undefined) return;

    try {
        const nextTuition = monthlyTuition !== undefined ? monthlyTuition : updatedStudent.monthly_tuition;
        const nextDiscountRate = discountRate !== undefined ? discountRate : (updatedStudent.discount_rate || 0);
        const finalTuition = nextTuition * (1 - nextDiscountRate / 100);
        const currentYearMonth = new Date().toISOString().slice(0, 7);

        await pool.execute(
            `UPDATE student_payments
             SET base_amount = ?, final_amount = ?, updated_at = NOW()
             WHERE student_id = ?
               AND academy_id = ?
               AND \`year_month\` >= ?
               AND payment_status = 'pending'
               AND payment_type = 'monthly'
               AND NOT (is_prorated = 1 OR description LIKE '%일할계산%')`,
            [nextTuition, finalTuition, studentId, academyId, currentYearMonth]
        );
        logger.info(`[Student ${studentId}] Pending payments updated: ${nextTuition}원 (할인 후: ${finalTuition}원)`);
    } catch (error) {
        logger.error('Payment update failed:', error);
    }
}

function countClassDays(year, month, enrollDay, classDays) {
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    let classDaysCount = 0;
    let totalClassDaysInMonth = 0;

    for (let day = 1; day <= lastDayOfMonth; day++) {
        if (!classDays.includes(new Date(year, month - 1, day).getDay())) continue;
        totalClassDaysInMonth++;
        if (day >= enrollDay) classDaysCount++;
    }
    return { lastDayOfMonth, classDaysCount, totalClassDaysInMonth };
}

async function recalculateEnrollmentPayment(context) {
    const {
        pool,
        studentId,
        academyId,
        enrollmentDate,
        oldStudent,
        updatedStudent,
        currentTimeSlot,
    } = context;
    const oldEnrollmentDate = oldStudent.enrollment_date;
    if (
        enrollmentDate === undefined
        || !enrollmentDate
        || !oldEnrollmentDate
        || String(enrollmentDate) === String(oldEnrollmentDate)
    ) {
        return null;
    }

    try {
        const oldYearMonth = String(oldEnrollmentDate).slice(0, 7);
        const [proratedRows] = await pool.execute(
            `SELECT id, payment_status FROM student_payments
             WHERE student_id = ? AND academy_id = ?
               AND \`year_month\` = ? AND payment_type = 'monthly'
               AND (is_prorated = 1 OR description LIKE '%일할계산%')`,
            [studentId, academyId, oldYearMonth]
        );
        if (proratedRows.length === 0) return null;

        const proratedPayment = proratedRows[0];
        const enrollDate = new Date(`${enrollmentDate}T00:00:00`);
        const year = enrollDate.getFullYear();
        const month = enrollDate.getMonth() + 1;
        const enrollDay = enrollDate.getDate();
        const newYearMonth = `${year}-${String(month).padStart(2, '0')}`;
        let duplicateRows = [];
        if (newYearMonth !== oldYearMonth) {
            const [rows] = await pool.execute(
                `SELECT id FROM student_payments
                 WHERE student_id = ? AND academy_id = ?
                   AND \`year_month\` = ? AND payment_type = 'monthly' AND id != ?`,
                [studentId, academyId, newYearMonth, proratedPayment.id]
            );
            duplicateRows = rows;
        }

        if (proratedPayment.payment_status !== 'pending') {
            return {
                type: 'skipped',
                message: '첫 달 학원비가 이미 납부되어 재계산하지 않았습니다. 결제 내역에서 직접 수정해주세요.',
            };
        }
        if (duplicateRows.length > 0) {
            return {
                type: 'skipped',
                message: `${month}월 학원비가 이미 있어 재계산하지 않았습니다. 결제 내역에서 직접 정리해주세요.`,
            };
        }

        const baseAmount = parseFloat(updatedStudent.monthly_tuition) || 0;
        const discountRate = parseFloat(updatedStudent.discount_rate) || 0;
        const classDaysRaw = updatedStudent.class_days
            ? (typeof updatedStudent.class_days === 'string'
                ? JSON.parse(updatedStudent.class_days)
                : updatedStudent.class_days)
            : [];
        const classDays = extractDayNumbers(parseClassDaysWithSlots(classDaysRaw, currentTimeSlot));
        const { lastDayOfMonth, classDaysCount, totalClassDaysInMonth } = countClassDays(
            year,
            month,
            enrollDay,
            classDays
        );
        const remainingDays = lastDayOfMonth - enrollDay + 1;
        const proratedAmount = totalClassDaysInMonth > 0 && classDaysCount > 0
            ? truncateToThousands(baseAmount / totalClassDaysInMonth * classDaysCount)
            : truncateToThousands(baseAmount * remainingDays / lastDayOfMonth);
        const discountAmount = truncateToThousands(proratedAmount * discountRate / 100);
        const finalAmount = proratedAmount - discountAmount;
        const dueDate = resolveProratedPaymentDueDate(String(enrollmentDate));

        await pool.execute(
            `UPDATE student_payments
             SET \`year_month\` = ?, target_year = ?, target_month = ?,
                 base_amount = ?, discount_amount = ?, final_amount = ?,
                 is_prorated = 1, proration_details = ?,
                 due_date = ?, description = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                newYearMonth,
                year,
                month,
                proratedAmount,
                discountAmount,
                finalAmount,
                JSON.stringify({
                    enrollDay,
                    remainingDays,
                    totalDays: lastDayOfMonth,
                    classCountInPeriod: classDaysCount,
                    totalClassDaysInMonth,
                }),
                dueDate,
                `${month}월 학원비 (${enrollDay}일 등록, 일할계산)`,
                proratedPayment.id,
            ]
        );
        logger.info(`[Student ${studentId}] Prorated payment recalculated for enrollment_date change ${oldEnrollmentDate} → ${enrollmentDate}: ${finalAmount}원`);
        return {
            type: 'recalculated',
            message: `등록일 변경으로 첫 달 학원비 재계산: ${finalAmount.toLocaleString()}원 (${enrollDay}일 등록)`,
            finalAmount,
        };
    } catch (error) {
        logger.error('Enrollment date payment recalc failed:', error);
        return null;
    }
}

async function createActivationPayment(context) {
    const {
        pool,
        studentId,
        academyId,
        status,
        oldStatus,
        monthlyTuition,
        discountRate,
        enrollmentDate,
        classDays,
        currentTimeSlot,
    } = context;
    if (
        status !== 'active'
        || !['pending', 'trial'].includes(oldStatus)
        || !monthlyTuition
        || monthlyTuition <= 0
    ) {
        return;
    }

    try {
        const enrollmentDateText = enrollmentDate || getKoreaDateText();
        const enrollDate = new Date(`${enrollmentDateText}T00:00:00`);
        const year = enrollDate.getFullYear();
        const month = enrollDate.getMonth() + 1;
        const [existingPayment] = await pool.execute(
            'SELECT id FROM student_payments WHERE student_id = ? AND target_year = ? AND target_month = ?',
            [studentId, year, month]
        );
        if (existingPayment.length > 0) return;

        const enrollDay = enrollDate.getDate();
        const classDayNumbers = extractDayNumbers(parseClassDaysWithSlots(classDays || [], currentTimeSlot));
        const { lastDayOfMonth, classDaysCount, totalClassDaysInMonth } = countClassDays(
            year,
            month,
            enrollDay,
            classDayNumbers
        );
        const remainingDays = lastDayOfMonth - enrollDay + 1;
        const proratedAmount = totalClassDaysInMonth > 0
            ? Math.floor(monthlyTuition * classDaysCount / totalClassDaysInMonth / 1000) * 1000
            : monthlyTuition;
        const discountAmount = discountRate
            ? Math.floor(proratedAmount * discountRate / 100 / 1000) * 1000
            : 0;
        const finalAmount = proratedAmount - discountAmount;
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const description = `${month}월 학원비 (${enrollDay}일 등록, 일할계산)`;
        const dueDate = resolveProratedPaymentDueDate(enrollmentDateText);

        await pool.execute(
            `INSERT INTO student_payments (
                student_id, academy_id, \`year_month\`, payment_type, target_year, target_month,
                base_amount, discount_amount, additional_amount, final_amount,
                is_prorated, proration_details, due_date, payment_status, description
            ) VALUES (?, ?, ?, 'monthly', ?, ?, ?, ?, 0, ?, ?, ?, ?, 'pending', ?)`,
            [
                studentId,
                academyId,
                yearMonth,
                year,
                month,
                proratedAmount,
                discountAmount,
                finalAmount,
                1,
                JSON.stringify({
                    enrollDay,
                    remainingDays,
                    totalDays: lastDayOfMonth,
                    classCountInPeriod: classDaysCount,
                    totalClassDaysInMonth,
                }),
                dueDate,
                description,
            ]
        );
        logger.info(`[Student ${studentId}] Payment created from pending: ${finalAmount}원 (${description})`);
    } catch (error) {
        logger.error('Pending→Active payment creation failed:', error);
    }
}

async function adjustPausedPayment(context) {
    const { pool, studentId, academyId, status, oldStatus, updatedStudent } = context;
    if (status !== 'paused' || oldStatus !== 'active') return null;

    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const monthlyTotal = (updatedStudent.weekly_count || 2) * 4;
        const monthlyTuition = updatedStudent.monthly_tuition || 0;
        const [attendanceCount] = await pool.execute(
            `SELECT COUNT(*) as count FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
             AND cs.academy_id = ?
             AND YEAR(cs.class_date) = ?
             AND MONTH(cs.class_date) = ?
             AND a.attendance_status IN ('present', 'late')`,
            [studentId, academyId, currentYear, currentMonth]
        );
        const attendedCount = attendanceCount[0].count;
        const [payments] = await pool.execute(
            `SELECT id, amount, status, paid_amount FROM payments
             WHERE student_id = ?
             AND academy_id = ?
             AND year = ?
             AND month = ?`,
            [studentId, academyId, currentYear, currentMonth]
        );
        if (payments.length === 0) return null;

        const payment = payments[0];
        const proratedAmount = Math.floor((monthlyTuition * attendedCount / monthlyTotal) / 1000) * 1000;
        if (payment.status === 'paid') {
            const remainingCount = monthlyTotal - attendedCount;
            const creditAmount = Math.floor((monthlyTuition * remainingCount / monthlyTotal) / 1000) * 1000;
            if (creditAmount <= 0) return null;
            await pool.execute(
                `INSERT INTO rest_credits (student_id, academy_id, original_amount, remaining_amount, reason, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    studentId,
                    academyId,
                    creditAmount,
                    creditAmount,
                    `${currentYear}년 ${currentMonth}월 휴원 이월 (${remainingCount}/${monthlyTotal}회)`,
                ]
            );
            return {
                type: 'credit',
                message: `납부완료 학원비 이월: ${creditAmount.toLocaleString()}원 (${remainingCount}회분)`,
                creditAmount,
            };
        }

        if (attendedCount === 0) {
            await pool.execute('DELETE FROM payments WHERE id = ?', [payment.id]);
            return { type: 'deleted', message: '수업 미진행으로 학원비 삭제됨' };
        }

        await pool.execute(
            `UPDATE payments SET amount = ?, description = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                proratedAmount,
                `${currentYear}년 ${currentMonth}월 수강료 (휴원 일할: ${attendedCount}/${monthlyTotal}회)`,
                payment.id,
            ]
        );
        return {
            type: 'prorated',
            message: `일할계산 적용: ${proratedAmount.toLocaleString()}원 (${attendedCount}/${monthlyTotal}회)`,
            originalAmount: payment.amount,
            proratedAmount,
        };
    } catch (error) {
        logger.error('Payment adjustment failed:', error);
        return null;
    }
}

async function cleanupWithdrawal(context) {
    const { pool, studentId, academyId, status } = context;
    if (!['withdrawn', 'graduated'].includes(status)) return null;

    try {
        let withdrawalInfo = null;
        const [unpaidPayments] = await pool.execute(
            `SELECT id, final_amount FROM student_payments
             WHERE student_id = ? AND academy_id = ? AND payment_status != 'paid'`,
            [studentId, academyId]
        );
        if (unpaidPayments.length > 0) {
            const totalUnpaid = unpaidPayments.reduce(
                (sum, payment) => sum + parseFloat(payment.final_amount || 0),
                0
            );
            await pool.execute(
                `DELETE FROM student_payments
                 WHERE student_id = ? AND academy_id = ? AND payment_status != 'paid'`,
                [studentId, academyId]
            );
            withdrawalInfo = {
                deletedPayments: unpaidPayments.length,
                totalUnpaidAmount: totalUnpaid,
                message: `미납 학원비 ${unpaidPayments.length}건 (${totalUnpaid.toLocaleString()}원) 삭제됨`,
            };
        }

        const [seasonEnrollments] = await pool.execute(
            `SELECT ss.id, ss.season_id, ss.season_fee, ss.payment_status, s.season_name
             FROM student_seasons ss
             JOIN seasons s ON ss.season_id = s.id
             WHERE ss.student_id = ?
             AND s.academy_id = ?
             AND ss.status IN ('registered', 'active')`,
            [studentId, academyId]
        );
        if (seasonEnrollments.length > 0) {
            const enrollmentIds = seasonEnrollments.map((enrollment) => enrollment.id);
            await pool.execute(
                'UPDATE student_seasons SET status = \'cancelled\', updated_at = NOW() WHERE id IN (?)',
                [enrollmentIds]
            );
            withdrawalInfo = withdrawalInfo || {};
            withdrawalInfo.cancelledSeasons = seasonEnrollments.map((enrollment) => ({
                id: enrollment.id,
                season_name: enrollment.season_name,
                season_fee: enrollment.season_fee,
                payment_status: enrollment.payment_status,
            }));
            withdrawalInfo.seasonMessage = `시즌 등록 ${seasonEnrollments.length}건 취소됨`;
        }

        const today = new Date().toISOString().split('T')[0];
        const [scheduleDeleteResult] = await pool.execute(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
             AND cs.academy_id = ?
             AND cs.class_date >= ?
             AND (a.attendance_status IS NULL OR a.attendance_status = 'absent')`,
            [studentId, academyId, today]
        );
        if (scheduleDeleteResult.affectedRows > 0) {
            withdrawalInfo = withdrawalInfo || {};
            withdrawalInfo.deletedSchedules = scheduleDeleteResult.affectedRows;
            withdrawalInfo.scheduleMessage = `스케줄 ${scheduleDeleteResult.affectedRows}건 삭제됨`;
        }
        return withdrawalInfo;
    } catch (error) {
        logger.error('Withdrawal payment cleanup failed:', error);
        return null;
    }
}

module.exports = {
    updatePendingPayments,
    recalculateEnrollmentPayment,
    createActivationPayment,
    adjustPausedPayment,
    cleanupWithdrawal,
};
