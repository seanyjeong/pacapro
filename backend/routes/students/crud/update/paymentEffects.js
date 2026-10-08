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
const lifecycleBilling = require('../../../../services/studentLifecycleBillingService');

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
        || !['pending', 'trial', 'prospect'].includes(oldStatus)
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
    const { pool, studentId, academyId, userId, status, oldStatus, updatedStudent } = context;
    if (!context.pauseBillingContext && (status !== 'paused' || oldStatus !== 'active')) return null;
    const billingContext = context.pauseBillingContext || lifecycleBilling.validateContext({
        academyId,
        studentId,
        userId,
        date: updatedStudent.rest_start_date || getKoreaDateText(),
        reason: updatedStudent.rest_reason || null,
    });
    return lifecycleBilling.pause(pool, billingContext);
}

async function cleanupWithdrawal(context) {
    const { pool, studentId, academyId, userId, status } = context;
    if (!['withdrawn', 'graduated'].includes(status)) return null;

    const today = getKoreaDateText();
    const withdrawalInfo = await lifecycleBilling.withdraw(pool, {
        academyId, studentId, userId, date: today, reason: null,
        student: context.oldStudent,
        previousDate: context.oldStudent?.status === 'paused' ? context.oldStudent.rest_start_date : null,
        expectedPreviewHash: context.expectedPreviewHash,
        legacyGraduation: status === 'graduated',
    });
    // Keep the existing future-attendance cleanup; billing rows and income history stay intact.
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
        withdrawalInfo.deletedSchedules = scheduleDeleteResult.affectedRows;
        withdrawalInfo.scheduleMessage = `스케줄 ${scheduleDeleteResult.affectedRows}건 삭제됨`;
    }
    return withdrawalInfo;
}

module.exports = {
    updatePendingPayments,
    recalculateEnrollmentPayment,
    createActivationPayment,
    adjustPausedPayment,
    cleanupWithdrawal,
};
