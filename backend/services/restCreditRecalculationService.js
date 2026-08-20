const {
    CREDIT_ROUNDING_UNIT,
    MILLISECONDS_PER_DAY,
} = require('../constants/restCredit');
const repository = require('../repositories/restCreditRepository');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class RestCreditRecalculationConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RestCreditRecalculationConflictError';
    }
}

class RestCreditRecalculationValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RestCreditRecalculationValidationError';
    }
}

function parseDate(value, label) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
        throw new RestCreditRecalculationValidationError(
            `${label}를 YYYY-MM-DD 형식으로 확인해주세요.`
        );
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new RestCreditRecalculationValidationError(
            `${label}를 YYYY-MM-DD 형식으로 확인해주세요.`
        );
    }
    return date;
}

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
    return new Date(date.getTime() + (days * MILLISECONDS_PER_DAY));
}

function getMonthEnd(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function getRestPeriod(student, resumeDateText) {
    const restStart = parseDate(student.rest_start_date, '휴식 시작 날짜');
    const resumeDate = parseDate(resumeDateText, '복귀 날짜');

    if (resumeDate < restStart) {
        throw new RestCreditRecalculationValidationError(
            '복귀 날짜는 휴식 시작일보다 빠를 수 없습니다.'
        );
    }

    const monthEnd = getMonthEnd(restStart);
    const plannedEnd = student.rest_end_date
        ? parseDate(student.rest_end_date, '휴식 종료 날짜')
        : monthEnd;
    const dayBeforeResume = addDays(resumeDate, -1);
    const effectiveEnd = new Date(Math.min(
        dayBeforeResume.getTime(),
        plannedEnd.getTime(),
        monthEnd.getTime()
    ));

    if (effectiveEnd < restStart) {
        return {
            daysInMonth: monthEnd.getUTCDate(),
            restDays: 0,
            restEndDate: formatDate(restStart),
            restStartDate: formatDate(restStart),
        };
    }

    return {
        daysInMonth: monthEnd.getUTCDate(),
        restDays: Math.floor(
            (effectiveEnd.getTime() - restStart.getTime()) / MILLISECONDS_PER_DAY
        ) + 1,
        restEndDate: formatDate(effectiveEnd),
        restStartDate: formatDate(restStart),
    };
}

function calculateCreditAmount(monthlyTuitionValue, daysInMonth, restDays) {
    const monthlyTuition = Number(monthlyTuitionValue);
    if (!Number.isFinite(monthlyTuition) || monthlyTuition < 0) {
        throw new RestCreditRecalculationValidationError(
            '월 수강료를 확인한 뒤 다시 복귀 처리해주세요.'
        );
    }

    return Math.floor(
        ((monthlyTuition / daysInMonth) * restDays) / CREDIT_ROUNDING_UNIT
    ) * CREDIT_ROUNDING_UNIT;
}

function getCreditUsage(credit) {
    const previousAmount = Number(credit.credit_amount);
    const previousRemaining = Number(credit.remaining_amount);
    const previousRestDays = Number(credit.rest_days);
    if (
        !Number.isFinite(previousAmount)
        || !Number.isFinite(previousRemaining)
        || !Number.isInteger(previousRestDays)
        || previousAmount < 0
        || previousRemaining < 0
        || previousRestDays < 0
        || previousRemaining > previousAmount
    ) {
        throw new RestCreditRecalculationConflictError(
            '휴식 크레딧 금액이 맞지 않습니다. 크레딧 내역을 먼저 확인해주세요.'
        );
    }

    return {
        previousAmount,
        previousRemaining,
        previousRestDays,
        usedAmount: previousAmount - previousRemaining,
    };
}

function resolveStatus(credit, creditAmount, remainingAmount, usedAmount) {
    if (credit.status === 'refunded') return 'refunded';
    if (creditAmount === 0 && usedAmount === 0) return 'cancelled';
    if (remainingAmount === 0) return 'applied';
    if (usedAmount > 0) return 'partial';
    return 'pending';
}

function isChanged(credit, recalculated) {
    return Number(credit.credit_amount) !== recalculated.creditAmount
        || Number(credit.remaining_amount) !== recalculated.remainingAmount
        || Number(credit.rest_days) !== recalculated.restDays
        || credit.rest_end_date !== recalculated.restEndDate
        || credit.status !== recalculated.status;
}

async function recalculateRestCreditsOnResume({ connection, student, resumeDate }) {
    const period = getRestPeriod(student, resumeDate);
    const credits = await repository.findCurrentRestCreditsForUpdate(connection, {
        academyId: student.academy_id,
        restStartDate: period.restStartDate,
        studentId: student.id,
    });

    if (credits.length === 0) return null;
    if (credits.length > 1) {
        throw new RestCreditRecalculationConflictError(
            '같은 휴식 기간의 크레딧이 여러 건입니다. 크레딧 내역을 먼저 확인해주세요.'
        );
    }

    const credit = credits[0];
    const creditAmount = calculateCreditAmount(
        student.monthly_tuition,
        period.daysInMonth,
        period.restDays
    );
    const { previousAmount, previousRestDays, usedAmount } = getCreditUsage(credit);
    const expectedPreviousAmount = calculateCreditAmount(
        student.monthly_tuition,
        period.daysInMonth,
        previousRestDays
    );

    if (previousAmount !== expectedPreviousAmount) {
        throw new RestCreditRecalculationConflictError(
            '휴식 크레딧 기준 금액과 현재 수강료가 다릅니다. 크레딧 내역을 먼저 확인해주세요.'
        );
    }

    if (usedAmount > creditAmount) {
        throw new RestCreditRecalculationConflictError(
            '이미 사용한 휴식 크레딧이 정상 금액보다 큽니다. 크레딧 사용 내역을 먼저 확인해주세요.'
        );
    }

    const remainingAmount = creditAmount - usedAmount;
    const status = resolveStatus(credit, creditAmount, remainingAmount, usedAmount);
    const result = {
        adjusted: false,
        creditId: credit.id,
        creditType: credit.credit_type,
        previousAmount,
        creditAmount,
        remainingAmount,
        usedAmount,
        restStartDate: period.restStartDate,
        restEndDate: period.restEndDate,
        restDays: period.restDays,
        status,
    };

    if (!isChanged(credit, result)) return result;

    const note = `[복귀 재계산] ${resumeDate} 복귀: ${period.restStartDate} ~ `
        + `${period.restEndDate} (${period.restDays}일), `
        + `${previousAmount.toLocaleString()}원 → ${creditAmount.toLocaleString()}원`;

    await repository.updateRecalculatedCredit(connection, {
        academyId: student.academy_id,
        creditId: credit.id,
        creditAmount,
        note,
        remainingAmount,
        restDays: period.restDays,
        restEndDate: period.restEndDate,
        status,
        studentId: student.id,
    });

    return { ...result, adjusted: true };
}

module.exports = {
    RestCreditRecalculationConflictError,
    RestCreditRecalculationValidationError,
    recalculateRestCreditsOnResume,
};
