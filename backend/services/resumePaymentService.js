const repository = require('../repositories/resumePaymentRepository');
const { resolveProratedPaymentDueDate } = require('../utils/proratedPaymentDueDate');
const { CREDIT_ROUNDING_UNIT } = require('../constants/restCredit');
const { floorRatio, floorPercent } = require('../utils/monthlyBillAmounts');
const { isDirectlyPriced } = require('../utils/directBillAmount');
const { CLASS_DAY_NAMES } = require('../constants/classDayNames');
const { RestCreditRecalculationConflictError, RestCreditRecalculationValidationError } = require('./restCreditRecalculationService');


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
    const baseAmount = day === 1 ? tuition : floorRatio(tuition, remainingClassDays, totalClassDays, CREDIT_ROUNDING_UNIT);
    const discountAmount = floorPercent(baseAmount, Number(student.discount_rate) || 0, CREDIT_ROUNDING_UNIT);
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

    // 청구액을 직접 정한 청구: 완납이면 휴원 때도 손대지 않았으니 그대로 둔다. 아니면 휴원으로 줄인 몫을 알 수 없어 확인을 받는다
    if (isDirectlyPriced(payment)) {
        if (payment.payment_status === 'paid') return null;
        throw new RestCreditRecalculationConflictError('복귀월 청구액을 직접 정한 청구가 있습니다. 결제 내역에서 금액을 먼저 확인해주세요.');
    }

    const [year, month, resumeDay] = resumeDate.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const beforeRestDays = Number(student.rest_start_date.slice(8, 10)) - 1;
    const expectedPausedAmount = Math.max(floorRatio(fullAmount, beforeRestDays, daysInMonth, CREDIT_ROUNDING_UNIT), paidAmount);
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
        ? fullAmount : floorRatio(fullAmount, attendedDays, daysInMonth, CREDIT_ROUNDING_UNIT));
}

function planResumePayment({ student, resumeDate, classDays, creditRecalculation, payments, canCreateMonthlyPayment = true }) {
    const yearMonth = resumeDate.slice(0, 7);
    if (payments.length > 1) {
        throw new RestCreditRecalculationConflictError('복귀월 청구가 여러 건입니다. 정산 내역을 먼저 확인해주세요.');
    }
    if (payments.length) {
        const payment = payments[0];
        if (student.rest_start_date.slice(0, 7) !== yearMonth) return {};
        const finalAmount = calculateSameMonthAdjustment(payment, student, resumeDate, creditRecalculation);
        if (finalAmount === null || finalAmount === Number(payment.final_amount)) return {};
        return { paymentAdjusted: { id: payment.id, yearMonth, previousAmount: Number(payment.final_amount), finalAmount } };
    }
    if (!(Number(student.monthly_tuition) > 0) || !canCreateMonthlyPayment) return {};
    return { paymentCreated: { id: null, ...calculateResumePayment(student, resumeDate, classDays) } };
}

async function processResumePayment({ connection, student, resumeDate, classDays, creditRecalculation, recordedBy }) {
    const payments = await repository.findMonthlyPayments(connection, student, resumeDate.slice(0, 7));
    const canCreateMonthlyPayment = payments.length || !(Number(student.monthly_tuition) > 0)
        ? true : await repository.canCreateMonthlyPayment(connection, student, resumeDate.slice(0, 7));
    const plan = planResumePayment({ student, resumeDate, classDays, creditRecalculation, payments, canCreateMonthlyPayment });
    if (plan.paymentAdjusted) {
        await repository.adjustPayment(connection, student, payments[0], plan.paymentAdjusted.finalAmount, resumeDate);
    }
    if (plan.paymentCreated) {
        plan.paymentCreated.id = await repository.insertPayment(connection, student, plan.paymentCreated, recordedBy);
    }
    return plan;
}

module.exports = { processResumePayment, planResumePayment, calculateResumePayment, calculateSameMonthAdjustment, normalizeResumeClassDays };
