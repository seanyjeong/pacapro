/**
 * 급여 줄 저장 — 지급 완료된 급여는 어떤 경로로도 바꾸지 않는다(호출한 쪽이 잠근 행을 넘긴다).
 */
const repo = require('../repositories/salaryRepository');
const { buildBase, totals } = require('../utils/salaryBreakdown');

async function inTransaction(pool, work) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const result = await work(conn);
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

const parse = value => (typeof value === 'string' ? JSON.parse(value) : value) || null;
const hasOverride = salary => salary.base_override !== null && salary.base_override !== undefined;
const isPaid = salary => salary.payment_status === 'paid';

async function save(conn, salary, base, taxType, { mode = 'recalc', keepTaxIfPlain = false } = {}) {
    const adjustments = await repo.listAdjustments(conn, salary.id);
    const incentive = parseFloat(salary.incentive_amount) || 0;
    const deduction = parseFloat(salary.total_deduction) || 0;
    // 인센티브만 고칠 때는 지금까지처럼 세금을 그대로 둔다(재계산을 누르면 다시 계산)
    const keepTax = keepTaxIfPlain && adjustments.length === 0 && !base.nonTaxable
        ? { taxAmount: parseFloat(salary.tax_amount) || 0, insuranceDetails: parse(salary.insurance_details) } : null;
    const result = totals({ ...base, incentive, deduction, adjustments, taxType, yearMonth: salary.year_month, mode, keepTax });
    const details = {
        base_lines: base.lines,
        non_taxable_base: base.nonTaxable,
        adjustments: adjustments.map(({ id, label, amount, taxable, memo }) => ({ id, label, amount, taxable: Boolean(Number(taxable)), memo })),
        taxable_amount: result.taxableAmount
    };
    const columns = {
        base_amount: base.baseAmount, tax_type: taxType, tax_amount: result.taxAmount,
        insurance_details: result.insuranceDetails ? JSON.stringify(result.insuranceDetails) : null,
        net_salary: result.netSalary, adjustment_amount: result.adjustmentAmount, calculation_details: JSON.stringify(details),
        ...(base.counts ? { morning_classes: base.counts.morning, afternoon_classes: base.counts.afternoon, evening_classes: base.counts.evening, total_hours: base.totalHours } : {})
    };
    await conn.execute(
        `UPDATE salary_records SET ${Object.keys(columns).map(key => `${key} = ?`).join(', ')}, updated_at = NOW()
         WHERE id = ? AND COALESCE(payment_status, 'pending') <> 'paid'`,
        [...Object.values(columns), salary.id]
    );
    return { ...base, ...result, incentive, deduction, taxType, details };
}

// 출근·단가·규칙으로 기본급부터 다시 계산한다(기본급을 직접 입력해 두었으면 그 금액)
async function recalculate(conn, salary, mode = 'recalc') {
    const attendances = await repo.monthAttendances(conn, salary.instructor_id, salary.year_month);
    const rules = await repo.monthRules(conn, salary.instructor_id, salary.year_month);
    const installments = await repo.monthInstallments(conn, salary.instructor_id, salary.year_month);
    const adjustments = await repo.listAdjustments(conn, salary.id);
    // 규칙·분할·조정·직접 입력이 하나라도 있으면 어디서 계산해도 같은 금액이 되게 재계산 방식으로 맞춘다
    const custom = rules.length + installments.length + adjustments.length > 0 || hasOverride(salary);
    if (custom) mode = 'recalc';
    const base = buildBase({ instructor: salary, attendances, rules, installments, override: salary.base_override, mode });
    return save(conn, salary, base, salary.instructor_tax_type || 'none', { mode });
}

// 기본급은 그대로 두고 인센티브·공제·조정·세금·실수령액만 다시 맞춘다
async function refreshTotals(conn, salary, options) {
    const details = parse(salary.calculation_details);
    const base = {
        baseAmount: parseFloat(salary.base_amount) || 0,
        nonTaxable: details?.non_taxable_base || 0,
        lines: details?.base_lines || []
    };
    return save(conn, salary, base, salary.tax_type, options);
}

// 출근 체크 뒤: 그 달 급여 줄을 만들거나 다시 계산한다. 결석은 줄을 새로 만들지 않는다.
async function recalculateMonth(conn, { instructorId, academyId, yearMonth, create = true, mode = 'recalc' }) {
    const [[instructor]] = await conn.execute(
        'SELECT id, tax_type FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
        [instructorId, academyId]
    );
    if (!instructor) return null;
    if (create) await repo.createEmptySalary(conn, instructorId, yearMonth, instructor.tax_type);
    const salary = await repo.lockSalaryByMonth(conn, instructorId, yearMonth);
    if (!salary || isPaid(salary)) return null;
    return recalculate(conn, salary, mode);
}

// 이번 달까지의 분할 지급 달 중 급여 줄이 없는 것을 만든다
async function createInstallmentSalaries(conn, { throughMonth = repo.currentMonth(), instructorId = null } = {}) {
    const missing = await repo.missingInstallmentSalaries(conn, throughMonth, instructorId);
    for (const row of missing) {
        await recalculateMonth(conn, { instructorId: row.instructor_id, academyId: row.academy_id, yearMonth: row.pay_year_month });
    }
    return missing.length;
}

module.exports = { isPaid, inTransaction, recalculate, refreshTotals, recalculateMonth, createInstallmentSalaries };
