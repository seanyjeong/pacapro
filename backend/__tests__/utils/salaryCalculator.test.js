const {
    calculateTax33,
    calculate4Insurance,
    calculateHourlySalary,
    calculatePerClassSalary,
    calculateMonthlySalary,
    calculateInstructorSalary,
    INSURANCE_RATES,
} = require('../../utils/salaryCalculator');

describe('calculateTax33 (3.3% 프리랜서 세금)', () => {
    test('100만원 → 세금 33,000원', () => {
        const result = calculateTax33(1000000);
        expect(result.tax).toBe(33000);
        expect(result.netAmount).toBe(967000);
    });

    test('소수점 이하 버림 (Math.floor)', () => {
        // 500,500 * 0.033 = 16516.5 → 16516
        const result = calculateTax33(500500);
        expect(result.tax).toBe(16516);
        expect(result.netAmount).toBe(500500 - 16516);
    });

    test('0원일 때', () => {
        const result = calculateTax33(0);
        expect(result.tax).toBe(0);
        expect(result.netAmount).toBe(0);
    });

    test('세금 + 실수령액 = 총액', () => {
        const gross = 2500000;
        const result = calculateTax33(gross);
        expect(result.tax + result.netAmount).toBe(gross);
    });
});

describe('calculate4Insurance (4대보험)', () => {
    test('300만원 기본 계산', () => {
        const result = calculate4Insurance(3000000);

        // 국민연금 4.75%
        expect(result.nationalPension).toBe(Math.floor(3000000 * 0.0475));
        // 고용보험 0.9%
        expect(result.employmentInsurance).toBe(Math.floor(3000000 * 0.009));
        // 총 공제액 > 0
        expect(result.totalDeduction).toBeGreaterThan(0);
        // 실수령액 < 총액
        expect(result.netAmount).toBeLessThan(3000000);
    });

    test('공제 항목 합산 일치', () => {
        const result = calculate4Insurance(3000000);
        const sum = result.nationalPension + result.healthInsurance +
                    result.longTermCare + result.employmentInsurance;
        expect(result.totalDeduction).toBe(sum);
    });

    test('실수령액 10원 단위 절삭', () => {
        const result = calculate4Insurance(3000000);
        expect(result.netAmount % 10).toBe(0);
    });

    test('사업주 부담액도 계산됨', () => {
        const result = calculate4Insurance(3000000);
        expect(result.totalEmployerBurden).toBeGreaterThan(0);
        expect(result.employerBurden.industrialAccident).toBeGreaterThan(0);
    });

    test('요율 정보 포함', () => {
        const result = calculate4Insurance(3000000);
        expect(result.details.nationalPensionRate).toBe(INSURANCE_RATES.nationalPension.employee);
    });
});

describe('calculateHourlySalary (시급제)', () => {
    test('시급 15,000원 × 160시간 = 240만원 (세금 없음)', () => {
        const result = calculateHourlySalary(15000, 160, 'none');
        expect(result.baseAmount).toBe(2400000);
        expect(result.grossAmount).toBe(2400000);
        expect(result.netAmount).toBe(2400000);
        expect(result.taxAmount).toBe(0);
    });

    test('3.3% 세금 적용', () => {
        const result = calculateHourlySalary(20000, 100, '3.3%');
        expect(result.baseAmount).toBe(2000000);
        expect(result.taxAmount).toBe(Math.floor(2000000 * 0.033));
        expect(result.netAmount).toBe(2000000 - result.taxAmount);
    });

    test('4대보험 적용', () => {
        const result = calculateHourlySalary(20000, 100, 'insurance');
        expect(result.insuranceAmount).toBeGreaterThan(0);
        expect(result.insuranceDetails).not.toBeNull();
        expect(result.netAmount).toBeLessThan(2000000);
    });

    test('상여금 포함', () => {
        const result = calculateHourlySalary(10000, 100, 'none', 200000);
        expect(result.grossAmount).toBe(1200000); // 1,000,000 + 200,000
    });

    test('공제액 차감', () => {
        const result = calculateHourlySalary(10000, 100, 'none', 0, 50000);
        expect(result.grossAmount).toBe(950000); // 1,000,000 - 50,000
    });
});

describe('calculatePerClassSalary (타임제)', () => {
    test('수업당 30,000원 × 20회', () => {
        const result = calculatePerClassSalary(30000, 20, 'none');
        expect(result.baseAmount).toBe(600000);
        expect(result.netAmount).toBe(600000);
    });

    test('3.3% 세금 적용', () => {
        const result = calculatePerClassSalary(50000, 10, '3.3%');
        expect(result.taxAmount).toBe(Math.floor(500000 * 0.033));
    });
});

describe('calculateMonthlySalary (월급제)', () => {
    test('월급 300만원 (세금 없음)', () => {
        const result = calculateMonthlySalary(3000000, 'none');
        expect(result.baseAmount).toBe(3000000);
        expect(result.netAmount).toBe(3000000);
    });

    test('월급 300만원 + 4대보험', () => {
        const result = calculateMonthlySalary(3000000, 'insurance');
        expect(result.netAmount).toBeLessThan(3000000);
        expect(result.insuranceDetails).not.toBeNull();
    });

    test('상여금 + 공제액', () => {
        const result = calculateMonthlySalary(3000000, 'none', 500000, 100000);
        expect(result.grossAmount).toBe(3400000); // 3,000,000 + 500,000 - 100,000
    });
});

describe('calculateInstructorSalary (통합 계산)', () => {
    test('시급제 강사', () => {
        const instructor = { salary_type: 'hourly', hourly_rate: 15000, tax_type: 'none' };
        const result = calculateInstructorSalary(instructor, { totalHours: 100 });
        expect(result.baseAmount).toBe(1500000);
    });

    test('타임제 강사', () => {
        const instructor = { salary_type: 'per_class', hourly_rate: 30000, tax_type: '3.3%' };
        const result = calculateInstructorSalary(instructor, { totalClasses: 20 });
        expect(result.baseAmount).toBe(600000);
        expect(result.taxAmount).toBe(Math.floor(600000 * 0.033));
    });

    test('월급제 강사', () => {
        const instructor = { salary_type: 'monthly', base_salary: 3000000, tax_type: 'insurance' };
        const result = calculateInstructorSalary(instructor, {});
        expect(result.baseAmount).toBe(3000000);
        expect(result.insuranceDetails).not.toBeNull();
    });

    test('알 수 없는 급여 타입이면 에러', () => {
        const instructor = { salary_type: 'unknown', tax_type: 'none' };
        expect(() => calculateInstructorSalary(instructor, {})).toThrow('Unknown salary type');
    });

    test('hourly_rate null이면 0으로 처리', () => {
        const instructor = { salary_type: 'hourly', hourly_rate: null, tax_type: 'none' };
        const result = calculateInstructorSalary(instructor, { totalHours: 100 });
        expect(result.baseAmount).toBe(0);
    });
});
