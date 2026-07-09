/**
 * 2026 social insurance calculator for employee payroll deductions.
 */

const NATIONAL_PENSION_LIMIT_PERIODS = [
    {
        fromYearMonth: '2026-07',
        minimumMonthlyIncome: 410000,
        maximumMonthlyIncome: 6590000
    },
    {
        fromYearMonth: '2026-01',
        minimumMonthlyIncome: 400000,
        maximumMonthlyIncome: 6370000
    }
];

const INSURANCE_RATES = {
    nationalPension: {
        employee: 0.0475,
        employeeNumerator: 475,
        denominator: 10000,
        employer: 0.0475,
        total: 0.095,
        minimumMonthlyIncome: 410000,
        maximumMonthlyIncome: 6590000
    },
    healthInsurance: {
        employee: 0.03595,
        employer: 0.03595,
        total: 0.0719,
        totalNumerator: 719,
        denominator: 10000
    },
    longTermCare: {
        premiumRate: 0.009448,
        premiumNumerator: 9448,
        premiumDenominator: 1000000,
        healthPremiumRatio: 0.009448 / 0.0719
    },
    employmentInsurance: {
        employee: 0.009,
        employeeNumerator: 9,
        denominator: 1000,
        employer: 0.009,
        total: 0.018
    },
    industrialAccident: {
        employer: 0.007
    },
    employmentStability: {
        employer: 0.0025
    }
};

function normalizeAmount(amount) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return 0;
    }
    return numericAmount;
}

function normalizeYearMonth(yearMonth) {
    if (typeof yearMonth === 'string' && /^\d{4}-\d{2}$/.test(yearMonth)) {
        return yearMonth;
    }
    return new Date().toISOString().slice(0, 7);
}

function getNationalPensionLimits(yearMonth) {
    const normalizedYearMonth = normalizeYearMonth(yearMonth);
    return NATIONAL_PENSION_LIMIT_PERIODS.find((period) => normalizedYearMonth >= period.fromYearMonth)
        || NATIONAL_PENSION_LIMIT_PERIODS[NATIONAL_PENSION_LIMIT_PERIODS.length - 1];
}

function clampNationalPensionBase(grossAmount, yearMonth) {
    const amount = normalizeAmount(grossAmount);
    if (amount === 0) {
        return 0;
    }

    const limits = getNationalPensionLimits(yearMonth);
    return Math.min(
        Math.max(amount, limits.minimumMonthlyIncome),
        limits.maximumMonthlyIncome
    );
}

function floorByRate(amount, numerator, denominator) {
    return Math.floor((amount * numerator) / denominator);
}

function calculate4Insurance(grossAmount, yearMonth) {
    const amount = normalizeAmount(grossAmount);
    const nationalPensionBase = clampNationalPensionBase(amount, yearMonth);
    const healthInsuranceTotal = floorByRate(
        amount,
        INSURANCE_RATES.healthInsurance.totalNumerator,
        INSURANCE_RATES.healthInsurance.denominator
    );
    const longTermCareTotal = Math.floor(
        (amount * INSURANCE_RATES.longTermCare.premiumNumerator)
        / (INSURANCE_RATES.longTermCare.premiumDenominator * 10)
    ) * 10;

    const nationalPension = floorByRate(
        nationalPensionBase,
        INSURANCE_RATES.nationalPension.employeeNumerator,
        INSURANCE_RATES.nationalPension.denominator
    );
    const healthInsurance = Math.floor(healthInsuranceTotal * 0.5);
    const longTermCare = Math.floor(longTermCareTotal * 0.5);
    const employmentInsurance = floorByRate(
        amount,
        INSURANCE_RATES.employmentInsurance.employeeNumerator,
        INSURANCE_RATES.employmentInsurance.denominator
    );

    const totalDeduction = nationalPension + healthInsurance + longTermCare + employmentInsurance;
    const netAmount = Math.floor((amount - totalDeduction) / 10) * 10;

    const employerBurden = {
        nationalPension,
        healthInsurance: Math.floor(healthInsuranceTotal * 0.5),
        longTermCare: Math.floor(longTermCareTotal * 0.5),
        employmentInsurance,
        stability: Math.floor(amount * INSURANCE_RATES.employmentStability.employer),
        industrialAccident: Math.floor(amount * INSURANCE_RATES.industrialAccident.employer)
    };

    const totalEmployerBurden = Object.values(employerBurden).reduce((sum, value) => sum + value, 0);
    const pensionLimits = getNationalPensionLimits(yearMonth);

    return {
        nationalPension,
        healthInsurance,
        longTermCare,
        employmentInsurance,
        totalDeduction,
        netAmount,
        employerBurden,
        totalEmployerBurden,
        details: {
            nationalPensionRate: INSURANCE_RATES.nationalPension.employee,
            nationalPensionBase,
            nationalPensionMinimumBase: pensionLimits.minimumMonthlyIncome,
            nationalPensionMaximumBase: pensionLimits.maximumMonthlyIncome,
            healthInsuranceRate: INSURANCE_RATES.healthInsurance.employee,
            longTermCareRate: INSURANCE_RATES.longTermCare.healthPremiumRatio,
            employmentInsuranceRate: INSURANCE_RATES.employmentInsurance.employee
        }
    };
}

module.exports = {
    INSURANCE_RATES,
    calculate4Insurance,
    clampNationalPensionBase,
    getNationalPensionLimits
};
