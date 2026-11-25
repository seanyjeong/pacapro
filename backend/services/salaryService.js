/**
 * 급여 줄 저장 — 지급 완료된 급여는 어떤 경로로도 바꾸지 않는다(호출한 쪽이 잠근 행을 넘긴다).
 */
const repo = require('../repositories/salaryRepository');
const { buildBase, totals } = require('../utils/salaryBreakdown');

const RETRYABLE = ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'];

// 잠근 뒤에 읽는 값이 항상 최신이 되도록 READ COMMITTED 로 돈다(잠금을 기다리는 동안 커밋된 조정·규칙·출근을 놓치지 않는다)
async function inTransaction(pool, work, attempts = 3) {
    const conn = await pool.getConnection();
    try {
        await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await conn.beginTransaction();
        const result = await work(conn);
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback();
        if (attempts <= 1 || !RETRYABLE.includes(error.code)) throw error;
    } finally {
        conn.release();
    }
    return inTransaction(pool, work, attempts - 1);
}

const parse = value => (typeof value === 'string' ? JSON.parse(value) : value) || null;
const hasOverride = salary => salary.base_override !== null && salary.base_override !== undefined;
const isPaid = salary => salary.payment_status === 'paid';
const RULE_KINDS = ['rule', 'excluded', 'installment'];
const hasRuleLines = lines => lines.some(line => RULE_KINDS.includes(line.kind));
const negative = () => Object.assign(new Error('NEGATIVE_SALARY'), { status: 400,
    body: { error: 'NEGATIVE_SALARY', message: '실수령액이 0원보다 작아집니다. 금액을 확인해 주세요.' } });

// 마지막에 어느 방식으로 계산했는지. 기록이 없는 예전 급여는 저장된 세금·실수령액이 맞는 방식, 둘 다 아니면 10원 단위인지로 본다
function lastMode(salary) {
    const stored = parse(salary.calculation_details)?.mode;
    if (stored) return stored;
    const [tax, net] = [Number(salary.tax_amount), Number(salary.net_salary)];
    const matched = ['auto', 'recalc'].find(mode => {
        const result = totals({ baseAmount: Number(salary.base_amount) || 0, incentive: Number(salary.incentive_amount) || 0,
            deduction: Number(salary.total_deduction) || 0, taxType: salary.tax_type, yearMonth: salary.year_month, mode });
        return result.taxAmount === tax && result.netSalary === net;
    });
    return matched ?? (net % 10 !== 0 ? 'auto' : 'recalc');
}

async function save(conn, salary, base, { mode, keepTax = false }) {
    const adjustments = await repo.listAdjustments(conn, salary.id);
    const incentive = parseFloat(salary.incentive_amount) || 0;
    const deduction = parseFloat(salary.total_deduction) || 0;
    const custom = adjustments.length > 0 || hasOverride(salary) || hasRuleLines(base.lines);
    // 세금 대상이 그대로면(인센티브만 고치거나 세금에 안 넣는 조정만 바꾸면) 지금 세금을 그대로 둔다
    const taxableBefore = (parse(salary.calculation_details)?.adjustments ?? []).filter(item => item.taxable);
    const taxableNow = adjustments.filter(item => Number(item.taxable));
    const sameTaxable = JSON.stringify(taxableBefore.map(item => item.amount)) === JSON.stringify(taxableNow.map(item => item.amount));
    const kept = keepTax && sameTaxable
        ? { taxAmount: parseFloat(salary.tax_amount) || 0, insuranceDetails: parse(salary.insurance_details) } : null;
    // 강사의 세금 유형이 바뀐 옛 급여 줄은 낡은 유형이 남아 있을 수 있다 — 다시 계산할 때는 강사 설정을 쓴다
    const taxType = kept ? salary.tax_type : salary.instructor_tax_type || 'none';
    const result = totals({ ...base, incentive, deduction, adjustments, taxType, yearMonth: salary.year_month, mode, custom, keepTax: kept });
    if (result.netSalary < 0) throw negative();
    const details = {
        mode,
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

async function computeBase(conn, salary, mode) {
    const attendances = await repo.monthAttendances(conn, salary.instructor_id, salary.year_month);
    const rules = await repo.monthRules(conn, salary.instructor_id, salary.year_month);
    const installments = await repo.monthInstallments(conn, salary.instructor_id, salary.year_month);
    return buildBase({ instructor: salary, attendances, rules, installments, override: salary.base_override, mode });
}

// 출근·단가·규칙으로 기본급부터 다시 계산한다(기본급을 직접 입력해 두었으면 그 금액). mode 를 안 주면 마지막에 계산한 방식
async function recalculate(conn, salary, mode = lastMode(salary)) {
    return save(conn, salary, await computeBase(conn, salary, mode), { mode });
}

// 규칙을 저장·삭제한 뒤: 규칙이 실제로 닿는(닿았던) 달만 다시 계산한다
async function recalculateIfRuled(conn, salary) {
    const mode = lastMode(salary);
    const base = await computeBase(conn, salary, mode);
    if (!hasRuleLines(base.lines) && !hasRuleLines(parse(salary.calculation_details)?.base_lines ?? [])) return false;
    await save(conn, salary, base, { mode });
    return true;
}

// 기본급은 그대로 두고 인센티브·공제·조정·세금·실수령액만 다시 맞춘다
async function refreshTotals(conn, salary) {
    const details = parse(salary.calculation_details);
    const base = {
        baseAmount: parseFloat(salary.base_amount) || 0,
        nonTaxable: details?.non_taxable_base || 0,
        lines: details?.base_lines || []
    };
    return save(conn, salary, base, { mode: lastMode(salary), keepTax: true });
}

// 출근 체크 뒤: 그 달 급여 줄을 만들거나 다시 계산한다. 결석은 줄을 새로 만들지 않는다.
async function recalculateMonth(conn, { instructorId, academyId, yearMonth, create = true, mode, onlyIfRuled = false }) {
    const [[instructor]] = await conn.execute(
        'SELECT id, tax_type FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
        [instructorId, academyId]
    );
    if (!instructor) return null;
    let salary = await repo.lockSalaryByMonth(conn, instructorId, yearMonth);
    if (!salary && create) {
        await repo.createEmptySalary(conn, instructorId, yearMonth, instructor.tax_type);
        salary = await repo.lockSalaryByMonth(conn, instructorId, yearMonth);
    }
    if (!salary || isPaid(salary)) return null;
    if (onlyIfRuled) return recalculateIfRuled(conn, salary);
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

// 예약 작업: 한 건이 실패해도 나머지 학원 명세서는 만든다
async function createAllInstallmentSalaries(pool, logger) {
    const missing = await repo.missingInstallmentSalaries(pool, repo.currentMonth());
    let created = 0;
    for (const row of missing) {
        try {
            await inTransaction(pool, conn => recalculateMonth(conn, { instructorId: row.instructor_id, academyId: row.academy_id, yearMonth: row.pay_year_month }));
            created += 1;
        } catch (error) {
            logger.error(`[SalaryInstallment] 강사 ${row.instructor_id} ${row.pay_year_month} 생성 실패:`, error);
        }
    }
    return created;
}

module.exports = { isPaid, inTransaction, createAllInstallmentSalaries, recalculate, refreshTotals, recalculateMonth, createInstallmentSalaries };
