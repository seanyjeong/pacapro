const repository = require('../repositories/resumePaymentRepository');
const { resolveProratedPaymentDueDate } = require('../utils/proratedPaymentDueDate');
const { CREDIT_ROUNDING_UNIT } = require('../constants/restCredit');
const { CLASS_DAY_NAMES } = require('../constants/classDayNames');
const { RestCreditRecalculationConflictError, RestCreditRecalculationValidationError } = require('./restCreditRecalculationService');

const round = amount => Math.floor(amount / CREDIT_ROUNDING_UNIT) * CREDIT_ROUNDING_UNIT;

function normalizeResumeClassDays(classDays) {
    const values = typeof classDays === 'string' ? JSON.parse(classDays) : (classDays || []);
    const normalized = Array.isArray(values)
        ? values.map(item => typeof item === 'string' ? CLASS_DAY_NAMES.indexOf(item) : item)
        : null;
    if (!normalized || normalized.some(item => {
        const day = typeof item === 'number' ? item : item?.day;
        return !Number.isInteger(day) || day < 0 || day > 6;
    })) {
        throw new RestCreditRecalculationValidationError('저장된 수업 요일을 확인한 뒤 복귀 처리해주세요.');
    }
    return normalized;
}

function calculateResumePayment(student, resumeDate, classDays) {
    const [year, month, day] = resumeDate.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days = classDays.map(item => typeof item === 'number' ? item : item.day);
    const totalClassDays = (days.length || 2) * 4;
    let remainingClassDays = 0;
    for (let date = day; date <= lastDay; date++) {
        if (!days.length || days.includes(new Date(Date.UTC(year, month - 1, date)).getUTCDay())) {
            remainingClassDays++;
        }
    }
    remainingClassDays = Math.min(remainingClassDays, totalClassDays);
    const tuition = Number(student.monthly_tuition);
    const baseAmount = day === 1 ? tuition : round(tuition * remainingClassDays / totalClassDays);
    const discountAmount = round(baseAmount * (Number(student.discount_rate) || 0) / 100);
    return {
        yearMonth: resumeDate.slice(0, 7), baseAmount, discountAmount,
        finalAmount: baseAmount - discountAmount, remainingClassDays, totalClassDays,
        dueDate: resolveProratedPaymentDueDate(resumeDate),
        description: `${month}월 학원비 (${day}일 복귀, 일할계산)`,
        notes: `복귀일: ${resumeDate}, 남은 수업일: ${remainingClassDays}/${totalClassDays}일`,
    };
}

function calculateSameMonthAdjustment(payment, student, resumeDate, creditRecalculation) {
    const fullAmount = Number(payment.base_amount) - Number(payment.discount_amount || 0)
        + Number(payment.additional_amount || 0) - Number(payment.carryover_amount || 0);
    const finalAmount = Number(payment.final_amount);
    const paidAmount = Number(payment.paid_amount || 0);
    if (finalAmount === fullAmount) return null; // A full bill already covers the return period.

    const [year, month, resumeDay] = resumeDate.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const beforeRestDays = Number(student.rest_start_date.slice(8, 10)) - 1;
    const expectedPausedAmount = Math.max(round(fullAmount * beforeRestDays / daysInMonth), paidAmount);
    // process-rest has no historical adjustment marker. Only restore its recognizable
    // calendar-day reduction; ambiguous/manual bills must be reviewed, never guessed.
    if (!Number.isFinite(fullAmount) || fullAmount < 0 || finalAmount !== expectedPausedAmount
        || finalAmount > fullAmount || creditRecalculation?.creditAmount > 0
        || Number(payment.carryover_amount || 0) > 0) {
        throw new RestCreditRecalculationConflictError(
            '복귀월 청구에 별도 조정 또는 크레딧이 있습니다. 정산 내역을 먼저 확인해주세요.'
        );
    }
    // Use the same calendar-day basis as process-rest, including the return date.
    const attendedDays = beforeRestDays + daysInMonth - resumeDay + 1;
    return Math.max(paidAmount, attendedDays === daysInMonth
        ? fullAmount : round(fullAmount * attendedDays / daysInMonth));
}

async function processResumePayment({ connection, student, resumeDate, classDays, creditRecalculation, recordedBy }) {
    const yearMonth = resumeDate.slice(0, 7);
    const payments = await repository.findMonthlyPayments(connection, student, yearMonth);
    if (payments.length > 1) {
        throw new RestCreditRecalculationConflictError('복귀월 청구가 여러 건입니다. 정산 내역을 먼저 확인해주세요.');
    }
    if (payments.length) {
        const payment = payments[0];
        if (student.rest_start_date.slice(0, 7) !== yearMonth) return {};
        const finalAmount = calculateSameMonthAdjustment(payment, student, resumeDate, creditRecalculation);
        if (finalAmount === null || finalAmount === Number(payment.final_amount)) return {};
        await repository.adjustPayment(connection, student, payment, finalAmount, resumeDate);
        return { paymentAdjusted: { id: payment.id, yearMonth, previousAmount: Number(payment.final_amount), finalAmount } };
    }
    if (!(Number(student.monthly_tuition) > 0)) return {};
    if (!await repository.canCreateMonthlyPayment(connection, student, yearMonth)) return {};
    const payment = calculateResumePayment(student, resumeDate, classDays);
    const id = await repository.insertPayment(connection, student, payment, recordedBy);
    return { paymentCreated: { id, ...payment } };
}

module.exports = { processResumePayment, calculateResumePayment, calculateSameMonthAdjustment, normalizeResumeClassDays };
