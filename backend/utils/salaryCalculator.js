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
        // 강사 정보 조회
        const [instructors] = await db.query(
            `SELECT id, name, salary_type, hourly_rate, base_salary, tax_type,
                    morning_class_rate, afternoon_class_rate, evening_class_rate
             FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
            [instructorId, academyId]
        );

        if (instructors.length === 0) {
            return null;
        }

        const instructor = instructors[0];

        // work_date에서 년월 계산 (year_month = 근무월)
        const workDateObj = new Date(workDate);
        const salaryYear = workDateObj.getFullYear();
        const salaryMonth = workDateObj.getMonth() + 1;
        const yearMonth = `${salaryYear}-${String(salaryMonth).padStart(2, '0')}`;

        // 출근 기록 조회할 년월 = 근무월과 동일
        const attendanceYearMonth = yearMonth;

        // 해당 월의 모든 출근 기록 조회
        const [monthlyAttendances] = await db.query(
            `SELECT time_slot, check_in_time, check_out_time, attendance_status
             FROM instructor_attendance
             WHERE instructor_id = ?
             AND DATE_FORMAT(work_date, '%Y-%m') = ?
             AND attendance_status IN ('present', 'late', 'half_day')`,
            [instructorId, attendanceYearMonth]
        );

        let baseAmount = 0;
        let totalHours = 0;
        let morningClasses = 0;
        let afternoonClasses = 0;
        let eveningClasses = 0;

        if (instructor.salary_type === 'hourly') {
            // 시급제: 총 근무 시간 계산 (분 단위)
            let totalMinutes = 0;
            for (const att of monthlyAttendances) {
                if (att.check_in_time && att.check_out_time) {
                    const [inH, inM] = att.check_in_time.split(':').map(Number);
                    const [outH, outM] = att.check_out_time.split(':').map(Number);
                    const inMinutes = inH * 60 + inM;
                    const outMinutes = outH * 60 + outM;
                    if (outMinutes > inMinutes) {
                        totalMinutes += (outMinutes - inMinutes);
                    }
                }
            }
            totalHours = totalMinutes / 60;
            const hourlyRate = parseFloat(instructor.hourly_rate) || 0;
            baseAmount = Math.round(totalHours * hourlyRate);
        } else if (instructor.salary_type === 'per_class') {
            // 타임제: 시간대별 수업 횟수로 계산
            for (const att of monthlyAttendances) {
                if (att.time_slot === 'morning') morningClasses++;
                else if (att.time_slot === 'afternoon') afternoonClasses++;
                else if (att.time_slot === 'evening') eveningClasses++;
            }

            const morningRate = parseFloat(instructor.morning_class_rate) || parseFloat(instructor.hourly_rate) || 0;
            const afternoonRate = parseFloat(instructor.afternoon_class_rate) || parseFloat(instructor.hourly_rate) || 0;
            const eveningRate = parseFloat(instructor.evening_class_rate) || parseFloat(instructor.hourly_rate) || 0;

            baseAmount = (morningClasses * morningRate) +
                        (afternoonClasses * afternoonRate) +
                        (eveningClasses * eveningRate);
        } else if (instructor.salary_type === 'monthly') {
            // 월급제: 기본 월급 적용 (출근 기록과 무관)
            baseAmount = parseFloat(instructor.base_salary) || 0;

            // 출근 기록은 참고용으로만 집계
            for (const att of monthlyAttendances) {
                if (att.time_slot === 'morning') morningClasses++;
                else if (att.time_slot === 'afternoon') afternoonClasses++;
                else if (att.time_slot === 'evening') eveningClasses++;
            }
        }

        // 세금 계산
        let taxAmount = 0;
        let insuranceDetails = null;

        if (instructor.tax_type === '3.3%') {
            taxAmount = Math.round(baseAmount * 0.033);
        } else if (instructor.tax_type === 'insurance') {
            const insurance = calculate4Insurance(baseAmount, yearMonth);
            taxAmount = insurance.totalDeduction;
            insuranceDetails = insurance;
        }

        const netSalary = baseAmount - taxAmount;

        // salary_records 업데이트 또는 생성
        const [existingSalary] = await db.query(
            'SELECT id FROM salary_records WHERE instructor_id = ? AND `year_month` = ?',
            [instructorId, yearMonth]
        );

        if (existingSalary.length > 0) {
            // 기존 레코드 업데이트
            await db.query(
                `UPDATE salary_records
                 SET base_amount = ?, tax_amount = ?, net_salary = ?,
                     total_hours = ?, morning_classes = ?, afternoon_classes = ?,
                     evening_classes = ?, insurance_details = ?, updated_at = NOW()
                 WHERE id = ?`,
                [baseAmount, taxAmount, netSalary, totalHours,
                 morningClasses, afternoonClasses, eveningClasses,
                 insuranceDetails ? JSON.stringify(insuranceDetails) : null,
                 existingSalary[0].id]
            );
        } else {
            // 새 레코드 생성
            await db.query(
                `INSERT INTO salary_records
                 (instructor_id, \`year_month\`, base_amount, incentive_amount, total_deduction,
                  tax_type, tax_amount, insurance_details, net_salary, total_hours,
                  morning_classes, afternoon_classes, evening_classes, payment_status)
                 VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [instructorId, yearMonth, baseAmount, instructor.tax_type,
                 taxAmount, insuranceDetails ? JSON.stringify(insuranceDetails) : null,
                 netSalary, totalHours, morningClasses, afternoonClasses, eveningClasses]
            );
        }

        return {
            yearMonth,
            baseAmount,
            taxAmount,
            netSalary,
            totalHours,
            morningClasses,
            afternoonClasses,
            eveningClasses
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
