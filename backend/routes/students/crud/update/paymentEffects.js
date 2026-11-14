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
const { updatePendingMonthlyTuition } = require('../../../../repositories/pendingMonthlyTuitionRepository');
const { floorRatio, floorPercent } = require('../../../../utils/monthlyBillAmounts');

async function updatePendingPayments(context) {
    const {
        pool,
        studentId,
        academyId,
        monthlyTuition,
        discountRate,
        updatedStudent,
    } = context;
    // A paused student's existing bill may already be reduced by process-rest.
    // The resume transaction restores it; saving the profile must not reset it.
    if (context.oldStatus === 'paused' || updatedStudent?.status === 'paused') return;
    if (monthlyTuition === undefined && discountRate === undefined) return;

    try {
        // 저장된 값(DECIMAL 칸에 맞춰진 학원비·할인율)으로 계산한다
        const nextTuition = updatedStudent ? updatedStudent.monthly_tuition : monthlyTuition;
        const nextDiscountRate = updatedStudent ? (updatedStudent.discount_rate || 0) : (discountRate || 0);
        // 반 학원비 적용·반 이동도 같은 함수로 미납 월 청구를 맞춘다.
        // 금액은 월 자동 청구와 같은 식(할인액·최종 천원 절삭, 추가 금액·크레딧 유지).
        const { final } = await updatePendingMonthlyTuition(pool, {
            studentId, academyId, tuition: nextTuition, discountRate: nextDiscountRate,
        });
        logger.info(`[Student ${studentId}] Pending payments updated: ${nextTuition}원 (할인 후: ${final}원)`);
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
            `SELECT id, payment_status, additional_amount, carryover_amount FROM student_payments
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
            ? floorRatio(baseAmount, classDaysCount, totalClassDaysInMonth)
            : floorRatio(baseAmount, remainingDays, lastDayOfMonth);
        const discountAmount = floorPercent(proratedAmount, discountRate);
        // 이미 적용된 크레딧·추가 금액은 재계산이 지우지 않는다 (payments/crud.js 수정과 같은 식).
        const additionalAmount = parseFloat(proratedPayment.additional_amount) || 0;
        const carryoverAmount = parseFloat(proratedPayment.carryover_amount) || 0;
        const finalAmount = Math.max(
            truncateToThousands(proratedAmount - discountAmount + additionalAmount) - carryoverAmount,
            0
        );
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

    // 저장된 값(DECIMAL 칸에 맞춰진 학원비·할인율)으로 계산한다 — 본문 값과 소수 자리가 다를 수 있다
    const tuition = Number(context.updatedStudent?.monthly_tuition ?? monthlyTuition);
    const rate = Number(context.updatedStudent?.discount_rate ?? discountRate) || 0;

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
            ? floorRatio(tuition, classDaysCount, totalClassDaysInMonth)
            : tuition;
        const discountAmount = rate
            ? floorPercent(proratedAmount, rate)
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
