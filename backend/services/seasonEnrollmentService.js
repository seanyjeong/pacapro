/**
 * 시즌 학생 등록·취소 — 화면(POST /paca/seasons/:id/enroll, POST /paca/seasons/enrollments/:id/cancel)과
 * AI 연결(season_enroll·season_enrollment_cancel)이 같은 계산·같은 청구 생성을 쓴다.
 * routes/seasons/{enroll,enrollments,monthly-cleanup}.js 에서 옮겨 왔고 동작은 그대로다.
 * plan* 은 DB를 읽지 않는 계산(미리보기에 그대로 보여 준다), apply* 는 받은 연결로만 쓴다 — 트랜잭션은 호출한 쪽이 연다.
 */

const logger = require('../utils/logger');
const {
    calculateProRatedFee,
    calculateMidSeasonFee,
    calculateSeasonRefund,
    parseWeeklyDays,
    truncateToThousands
} = require('../utils/seasonCalculator');
const { DEFAULT_SEASON_MONTHLY_POLICY } = require('../utils/seasonMonthlyPolicy');
const {
    autoAssignStudentToSeasonSchedules,
    removeStudentFromRegularSchedules
} = require('./seasonScheduleAssignment');

const VALID_TIME_SLOTS = ['morning', 'afternoon', 'evening'];

// 없으면 null, 허용 값이 하나도 없으면 false (화면은 400)
function parseSeasonTimeSlots(timeSlots) {
    if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) return null;
    const parsed = timeSlots.filter(ts => VALID_TIME_SLOTS.includes(ts));
    return parsed.length > 0 ? parsed : false;
}

function planSeasonEnrollment({ season, student, seasonFee, registrationDate, isContinuous, previousSeasonId, manualDiscount }) {
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

    const regDate = new Date(registrationDate || new Date());
    const seasonStartDate = new Date(season.season_start_date);
    const seasonEndDate = new Date(season.season_end_date);
    const yearMonth = `${seasonStartDate.getFullYear()}-${String(seasonStartDate.getMonth() + 1).padStart(2, '0')}`;

    let baseSeasonFee = parseFloat(seasonFee) || 0;
    let midSeasonProRated = null;

    if (regDate > seasonStartDate && season.operating_days) {
        try {
            const operatingDays = typeof season.operating_days === 'string'
                ? JSON.parse(season.operating_days)
                : season.operating_days;

            if (Array.isArray(operatingDays) && operatingDays.length > 0) {
                const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
                const weeklyDaysForSeason = operatingDays.map(d => typeof d === 'string' ? dayMap[d] : d).filter(d => d !== undefined);

                midSeasonProRated = calculateMidSeasonFee({
                    seasonFee: baseSeasonFee,
                    seasonStartDate: seasonStartDate,
                    seasonEndDate: seasonEndDate,
                    joinDate: regDate,
                    weeklyDays: weeklyDaysForSeason
                });

                baseSeasonFee = midSeasonProRated.proRatedFee;
            }
        } catch (midSeasonError) {
            logger.info('Mid-season prorated calculation skipped:', midSeasonError.message);
        }
    }

    let discountType = 'none';
    let discountAmount = 0;
    let finalSeasonFee = baseSeasonFee;

    if (isContinuous && previousSeasonId && season.continuous_discount_type !== 'none') {
        discountType = season.continuous_discount_type;
        if (discountType === 'free') {
            discountAmount = finalSeasonFee;
            finalSeasonFee = 0;
        } else if (discountType === 'rate' && season.continuous_discount_rate > 0) {
            discountAmount = truncateToThousands(finalSeasonFee * (season.continuous_discount_rate / 100));
            finalSeasonFee -= discountAmount;
        }
    }

    if (manualDiscount && parseFloat(manualDiscount) > 0) {
        const manualDiscountValue = parseFloat(manualDiscount) || 0;
        discountAmount += manualDiscountValue;
        finalSeasonFee -= manualDiscountValue;
        if (finalSeasonFee < 0) finalSeasonFee = 0;
        if (discountType === 'none') discountType = 'manual';
    }

    if (isNaN(baseSeasonFee)) baseSeasonFee = parseFloat(seasonFee) || 0;
    if (isNaN(finalSeasonFee)) finalSeasonFee = baseSeasonFee;
    if (isNaN(discountAmount)) discountAmount = 0;

    let actualDueDate;
    if (season.payment_due_date) {
        // 시즌 설정에 납부 마감일이 있으면 등록일 무관 항상 그 날짜 (미납자 판정 기준)
        actualDueDate = new Date(season.payment_due_date);
    } else {
        const dueDate = new Date(regDate);
        dueDate.setDate(dueDate.getDate() + 7);
        if (regDate > seasonStartDate) {
            actualDueDate = dueDate;
        } else {
            actualDueDate = dueDate < seasonStartDate ? dueDate : seasonStartDate;
        }
    }

    let description = `${season.season_name} 시즌비`;
    if (midSeasonProRated && midSeasonProRated.isProRated) {
        description += ` (중간합류 일할: ${midSeasonProRated.details})`;
    }

    return {
        proRated,
        proRatedMonth,
        midSeasonProRated,
        yearMonth,
        discountType,
        discountAmount,
        finalSeasonFee,
        payment: {
            yearMonth,
            baseAmount: parseFloat(seasonFee) || 0,
            additionalAmount: discountAmount + (midSeasonProRated?.discount || 0),
            finalAmount: finalSeasonFee || 0,
            dueDate: actualDueDate.toISOString().split('T')[0],
            description
        }
    };
}

function shouldUseLegacySeasonPaymentInsert(error) {
    if (!error) return false;
    const message = String(error.message || '');
    const missingSeasonIdColumn = (error.code === 'ER_BAD_FIELD_ERROR' || error.errno === 1054)
        && message.includes('season_id');
    const invalidSeasonIdReference = error.code === 'ER_NO_REFERENCED_ROW_2'
        && (message.includes('season_id') || message.includes('student_payments_ibfk_3'));
    return missingSeasonIdColumn || invalidSeasonIdReference;
}

async function insertSeasonPayment(conn, payment) {
    const params = [
        payment.studentId,
        payment.academyId,
        payment.yearMonth,
        payment.seasonId,
        payment.baseAmount,
        payment.additionalAmount,
        payment.finalAmount,
        payment.dueDate,
        payment.description,
        payment.recordedBy
    ];

    try {
        return await conn.execute(
            `INSERT INTO student_payments (
                student_id,
                academy_id,
                \`year_month\`,
                payment_type,
                season_id,
                base_amount,
                discount_amount,
                additional_amount,
                final_amount,
                due_date,
                payment_status,
                description,
                recorded_by
            ) VALUES (?, ?, ?, 'season', ?, ?, 0, ?, ?, ?, 'pending', ?, ?)`,
            params
        );
    } catch (error) {
        if (!shouldUseLegacySeasonPaymentInsert(error)) {
            throw error;
        }

        logger.warn('student_payments.season_id is not usable; using legacy season payment insert');
        return conn.execute(
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
            ) VALUES (?, ?, ?, 'season', ?, 0, ?, ?, ?, 'pending', ?, ?)`,
            [
                payment.studentId,
                payment.academyId,
                payment.yearMonth,
                payment.baseAmount,
                payment.additionalAmount,
                payment.finalAmount,
                payment.dueDate,
                payment.description,
                payment.recordedBy
            ]
        );
    }
}

async function deleteUnpaidMonthlyPaymentsForSeason(conn, studentId, academyId, season) {
    const policy = season.season_monthly_policy || DEFAULT_SEASON_MONTHLY_POLICY;
    if (policy !== DEFAULT_SEASON_MONTHLY_POLICY) {
        return { deleted: 0, skipped: true };
    }

    const startMonth = String(season.season_start_date).slice(0, 7);
    const endMonth = String(season.season_end_date).slice(0, 7);
    if (startMonth.length !== 7 || endMonth.length !== 7) {
        return { deleted: 0, skipped: true };
    }

    const [result] = await conn.execute(
        `DELETE FROM student_payments
         WHERE student_id = ?
         AND academy_id = ?
         AND payment_type = 'monthly'
         AND \`year_month\` BETWEEN ? AND ?
         AND payment_status IN ('pending', 'overdue', 'unpaid')
         AND COALESCE(paid_amount, 0) = 0`,
        [studentId, academyId, startMonth, endMonth]
    );

    return { deleted: result.affectedRows || 0, skipped: false };
}

/**
 * 1. student_seasons INSERT (기존 등록이 있으면 누락 시즌비만 복구) 2. students 시즌 표시 3. 시즌비 청구
 * 4. 시즌 기간 미납 월회비 정리 5. 진행 중 시즌이고 휴원생이 아니면 정규 출결 → 시즌 출결 (실패해도 등록은 유지)
 */
async function applySeasonEnrollment(conn, { season, seasonId, student, studentId, academyId, userId, existingEnrollmentId, plan, input }) {
    let enrollmentId = existingEnrollmentId;
    if (!enrollmentId) {
        const [result] = await conn.execute(
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
                studentId,
                seasonId,
                plan.finalSeasonFee || 0,
                input.registrationDate || new Date().toISOString().split('T')[0],
                input.afterSeasonAction || 'regular',
                plan.proRatedMonth,
                plan.proRated?.proRatedFee || 0,
                JSON.stringify(plan.proRated || { proRatedFee: 0 }),
                input.isContinuous || false,
                input.previousSeasonId || null,
                plan.discountType,
                plan.discountAmount || 0,
                input.discountReason || null,
                input.timeSlots ? JSON.stringify(input.timeSlots) : null
            ]
        );
        enrollmentId = result.insertId;
    }

    await conn.execute(
        `UPDATE students SET is_season_registered = true, current_season_id = ? WHERE id = ?`,
        [seasonId, studentId]
    );

    await insertSeasonPayment(conn, {
        ...plan.payment,
        studentId,
        academyId,
        seasonId,
        recordedBy: userId
    });

    await deleteUnpaidMonthlyPaymentsForSeason(conn, studentId, academyId, season);

    let removeResult = null;
    let seasonAssignResult = null;

    if (season.status === 'active' && student.status !== 'paused') {
        try {
            removeResult = await removeStudentFromRegularSchedules(
                studentId,
                academyId,
                season.season_start_date,
                season.season_end_date,
                conn
            );
        } catch (removeError) {
            logger.error('Remove from regular schedules failed:', removeError);
        }

        try {
            const studentGrade = student.grade || '';
            const regDateStr = input.registrationDate || new Date().toISOString().split('T')[0];
            seasonAssignResult = await autoAssignStudentToSeasonSchedules(
                studentId,
                academyId,
                season,
                studentGrade,
                student.student_type,
                input.timeSlots,
                regDateStr,
                conn
            );
        } catch (assignError) {
            logger.error('Season auto-assign failed:', assignError);
        }
    } else if (student.status === 'paused') {
        logger.info(`Student ${studentId} is paused, season schedules will be assigned on resume`);
    } else {
        logger.info(`Season ${seasonId} is not active (status: ${season.status}), skipping auto-assignment`);
    }

    return { enrollmentId, removeResult, seasonAssignResult };
}

// 환불 계산 — 시즌 운영 요일이 없으면 학생 수업 요일
function planSeasonCancel({ enrollment, operatingDays, cancelDate, includeVat }) {
    let weeklyDays = [];
    if (operatingDays) {
        weeklyDays = typeof operatingDays === 'string' ? JSON.parse(operatingDays) : operatingDays;
    } else {
        weeklyDays = parseWeeklyDays(enrollment.class_days);
    }

    const originalFee = parseFloat(enrollment.season_fee) || 0;
    const paidAmount = parseFloat(enrollment.paid_amount) || 0;

    const refund = calculateSeasonRefund({
        paidAmount: paidAmount,
        originalFee: originalFee,
        seasonStartDate: new Date(enrollment.season_start_date),
        seasonEndDate: new Date(enrollment.season_end_date),
        cancellationDate: new Date(cancelDate),
        weeklyDays,
        includeVat
    });

    return { originalFee, paidAmount, refund };
}

// 낸 돈이 있고 환불액이 있으면 지출(refund) 기록 → 등록 삭제 → 시즌 표시 해제 → 그 시즌의 완납 아닌 시즌비 청구 삭제
async function applySeasonCancel(conn, { enrollment, cancelDate, includeVat, refundAmount, paidAmount }) {
    if (refundAmount > 0 && paidAmount > 0) {
        await conn.execute(
            `INSERT INTO expenses (
                academy_id,
                category,
                amount,
                expense_date,
                description
            ) VALUES (?, 'refund', ?, ?, ?)`,
            [
                enrollment.academy_id,
                refundAmount,
                cancelDate,
                `시즌 중도 해지 환불 - ${enrollment.student_name} (${enrollment.season_name})${includeVat ? ' (부가세 제외)' : ''}`
            ]
        );
    }

    await conn.execute(`DELETE FROM student_seasons WHERE id = ?`, [enrollment.id]);

    await conn.execute(
        `UPDATE students SET is_season_registered = false, current_season_id = NULL WHERE id = ?`,
        [enrollment.student_id]
    );

    await conn.execute(
        `DELETE FROM student_payments
        WHERE student_id = ? AND payment_type = 'season' AND payment_status != 'paid'
        AND description LIKE ?`,
        [enrollment.student_id, `%${enrollment.season_name}%`]
    );
}

module.exports = {
    parseSeasonTimeSlots,
    planSeasonEnrollment,
    applySeasonEnrollment,
    planSeasonCancel,
    applySeasonCancel
};
