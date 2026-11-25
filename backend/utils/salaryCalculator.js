/**
 * 급여 계산 유틸리티
 *
 * 참고: c:/projects/i-max 4대보험 계산 로직
 *
 * 급여 형태:
 * - hourly: 시급 (시간당)
 * - per_class: 타임 (수업당)
 * - monthly: 고정급 (월급)
 *
 * 세금 형태:
 * - 3.3%: 3.3% 세금 (프리랜서)
 * - insurance: 4대보험 (정규직)
 * - none: 세금 없음
 */

const { INSURANCE_RATES, calculate4Insurance } = require('./socialInsuranceCalculator');

/**
 * 3.3% 세금 계산 (프리랜서)
 * @param {number} grossAmount - 총 지급액
 * @returns {object} { tax, netAmount }
 */
function calculateTax33(grossAmount) {
    const tax = Math.floor(grossAmount * 0.033);
    const netAmount = grossAmount - tax;

    return {
        tax,
        netAmount
    };
}

/**
 * 시급제 급여 계산
 * @param {number} hourlyRate - 시급
 * @param {number} totalHours - 총 근무 시간
 * @param {string} taxType - 세금 형태 (3.3%, insurance, none)
 * @param {number} bonus - 상여금 (선택)
 * @param {number} deduction - 공제액 (선택)
 * @param {string} yearMonth - 급여월 (YYYY-MM)
 * @returns {object} 급여 상세 내역
 */
function calculateHourlySalary(hourlyRate, totalHours, taxType, bonus = 0, deduction = 0, yearMonth) {
    const baseAmount = hourlyRate * totalHours;
    const grossAmount = baseAmount + bonus - deduction;

    let taxAmount = 0;
    let insuranceAmount = 0;
    let netAmount = grossAmount;
    let insuranceDetails = null;

    if (taxType === '3.3%') {
        const result = calculateTax33(grossAmount);
        taxAmount = result.tax;
        netAmount = result.netAmount;
    } else if (taxType === 'insurance') {
        const result = calculate4Insurance(grossAmount, yearMonth);
        insuranceAmount = result.totalDeduction;
        netAmount = result.netAmount;
        insuranceDetails = result;
    }

    return {
        baseAmount,
        bonus,
        deduction,
        grossAmount,
        taxType,
        taxAmount,
        insuranceAmount,
        netAmount,
        insuranceDetails,
        calculation: {
            hourlyRate,
            totalHours,
            formula: `${hourlyRate} × ${totalHours} + ${bonus} - ${deduction}`
        }
    };
}

/**
 * 타임제 급여 계산 (수업당)
 * @param {number} perClassRate - 수업당 금액
 * @param {number} totalClasses - 총 수업 횟수
 * @param {string} taxType - 세금 형태
 * @param {number} bonus - 상여금 (선택)
 * @param {number} deduction - 공제액 (선택)
 * @param {string} yearMonth - 급여월 (YYYY-MM)
 * @returns {object} 급여 상세 내역
 */
function calculatePerClassSalary(perClassRate, totalClasses, taxType, bonus = 0, deduction = 0, yearMonth) {
    const baseAmount = perClassRate * totalClasses;
    const grossAmount = baseAmount + bonus - deduction;

    let taxAmount = 0;
    let insuranceAmount = 0;
    let netAmount = grossAmount;
    let insuranceDetails = null;

    if (taxType === '3.3%') {
        const result = calculateTax33(grossAmount);
        taxAmount = result.tax;
        netAmount = result.netAmount;
    } else if (taxType === 'insurance') {
        const result = calculate4Insurance(grossAmount, yearMonth);
        insuranceAmount = result.totalDeduction;
        netAmount = result.netAmount;
        insuranceDetails = result;
    }

    return {
        baseAmount,
        bonus,
        deduction,
        grossAmount,
        taxType,
        taxAmount,
        insuranceAmount,
        netAmount,
        insuranceDetails,
        calculation: {
            perClassRate,
            totalClasses,
            formula: `${perClassRate} × ${totalClasses} + ${bonus} - ${deduction}`
        }
    };
}

/**
 * 월급제 급여 계산
 * @param {number} monthlySalary - 월 급여
 * @param {string} taxType - 세금 형태
 * @param {number} bonus - 상여금 (선택)
 * @param {number} deduction - 공제액 (선택)
 * @param {string} yearMonth - 급여월 (YYYY-MM)
 * @returns {object} 급여 상세 내역
 */
function calculateMonthlySalary(monthlySalary, taxType, bonus = 0, deduction = 0, yearMonth) {
    const baseAmount = monthlySalary;
    const grossAmount = baseAmount + bonus - deduction;

    let taxAmount = 0;
    let insuranceAmount = 0;
    let netAmount = grossAmount;
    let insuranceDetails = null;

    if (taxType === '3.3%') {
        const result = calculateTax33(grossAmount);
        taxAmount = result.tax;
        netAmount = result.netAmount;
    } else if (taxType === 'insurance') {
        const result = calculate4Insurance(grossAmount, yearMonth);
        insuranceAmount = result.totalDeduction;
        netAmount = result.netAmount;
        insuranceDetails = result;
    }

    return {
        baseAmount,
        bonus,
        deduction,
        grossAmount,
        taxType,
        taxAmount,
        insuranceAmount,
        netAmount,
        insuranceDetails,
        calculation: {
            monthlySalary,
            formula: `${monthlySalary} + ${bonus} - ${deduction}`
        }
    };
}

/**
 * 강사 급여 자동 계산
 * @param {object} instructor - 강사 정보
 * @param {number} workData - 근무 데이터 (시간/수업 횟수)
 * @param {number} bonus - 상여금 (선택)
 * @param {number} deduction - 공제액 (선택)
 * @returns {object} 급여 상세 내역
 */
function calculateInstructorSalary(instructor, workData, bonus = 0, deduction = 0) {
    const { salary_type, hourly_rate, base_salary, tax_type } = instructor;
    const calculationData = workData || {};
    const yearMonth = calculationData.yearMonth || calculationData.year_month;

    switch (salary_type) {
        case 'hourly':
            return calculateHourlySalary(
                hourly_rate || 0,
                calculationData.totalHours || 0,
                tax_type,
                bonus,
                deduction,
                yearMonth
            );

        case 'per_class':
            return calculatePerClassSalary(
                hourly_rate || 0,  // per_class도 hourly_rate 필드 사용
                calculationData.totalClasses || 0,
                tax_type,
                bonus,
                deduction,
                yearMonth
            );

        case 'monthly':
            return calculateMonthlySalary(
                base_salary || 0,
                tax_type,
                bonus,
                deduction,
                yearMonth
            );

        default:
            throw new Error(`Unknown salary type: ${salary_type}`);
    }
}

/**
 * 강사 출근 체크 시 급여 자동 계산/업데이트
 * @param {object} db - 데이터베이스 커넥션
 * @param {number} instructorId - 강사 ID
 * @param {number} academyId - 학원 ID
 * @param {string} workDate - 근무 날짜 (YYYY-MM-DD)
 * @param {string} attendanceStatus - 출근 상태
 * @returns {object|null} 업데이트된 급여 정보 또는 null
 */
async function updateSalaryFromAttendance(db, instructorId, academyId, workDate, attendanceStatus) {
    // 결석인 경우 급여 계산 스킵
    if (attendanceStatus === 'absent') {
        return null;
    }

    try {
        const { recalculateMonth } = require('../services/salaryService');
        // year_month = 근무월. 지급 완료된 달은 null
        const result = await recalculateMonth(db, { instructorId, academyId, yearMonth: String(workDate).slice(0, 7), mode: 'auto' });
        return result && {
            yearMonth: String(workDate).slice(0, 7),
            baseAmount: result.baseAmount,
            taxAmount: result.taxAmount,
            netSalary: result.netSalary,
            totalHours: result.totalHours,
            morningClasses: result.counts.morning,
            afternoonClasses: result.counts.afternoon,
            eveningClasses: result.counts.evening
        };
    } catch (error) {
        console.error('Error updating salary from attendance:', error);
        return null;
    }
}

module.exports = {
    INSURANCE_RATES,
    calculateTax33,
    calculate4Insurance,
    calculateHourlySalary,
    calculatePerClassSalary,
    calculateMonthlySalary,
    calculateInstructorSalary,
    updateSalaryFromAttendance
};
