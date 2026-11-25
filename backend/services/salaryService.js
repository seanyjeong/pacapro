/**
 * 급여 줄 저장 — 지급 완료된 급여는 어떤 경로로도 바꾸지 않는다(호출한 쪽이 잠근 행을 넘긴다).
 */
const repo = require('../repositories/salaryRepository');
const { buildBase, totals } = require('../utils/salaryBreakdown');

const RETRYABLE = ['ER_LOCK_DEADLOCK'];

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
const negative = yearMonth => Object.assign(new Error('NEGATIVE_SALARY'), { status: 400,
    body: { error: 'NEGATIVE_SALARY', message: `${yearMonth} 급여의 실수령액이 0원보다 작아집니다. 금액을 확인해 주세요.` } });

// 마지막에 어느 방식으로 계산했는지. 기록이 없는 예전 급여는 두 방식으로 다시 계산해 저장된 기본급과 맞는 쪽, 둘 다 맞거나 둘 다 안 맞으면 세금·실수령액까지 맞는 쪽
async function lastMode(conn, salary) {
    const stored = parse(salary.calculation_details)?.mode;
    if (stored) return stored;
    const attendances = await repo.monthAttendances(conn, salary.instructor_id, salary.year_month);
    const fits = ['auto', 'recalc'].filter(mode => Math.abs(buildBase({ instructor: salary, attendances, mode }).baseAmount - Number(salary.base_amount)) < 0.005);
    if (fits.length === 1) return fits[0];
    // 둘 다 안 맞으면(계산 뒤 단가·출근이 바뀜) 저장된 세금·실수령액으로 고른다
    const stands = fits.length ? fits : ['auto', 'recalc'];
    const [tax, net] = [Number(salary.tax_amount), Number(salary.net_salary)];
    const matched = stands.find(mode => {
        const result = totals({ baseAmount: Number(salary.base_amount) || 0, incentive: Number(salary.incentive_amount) || 0,
            deduction: Number(salary.total_deduction) || 0, taxType: salary.tax_type, yearMonth: salary.year_month, mode });
        return result.taxAmount === tax && result.netSalary === net;
    });
    return matched ?? (net % 10 !== 0 ? 'auto' : 'recalc');
}

async function save(conn, salary, base, { mode, keepTax = false, floorNet = false, allowNegative = false }) {
    const adjustments = await repo.listAdjustments(conn, salary.id);
    const incentive = parseFloat(salary.incentive_amount) || 0;
    const deduction = parseFloat(salary.total_deduction) || 0;
    // 실수령액을 10원 단위로 맞추는 급여: 조정·직접 입력·규칙·인센티브·공제가 있거나 사람이 금액을 고친 때
    const custom = floorNet || adjustments.length > 0 || hasOverride(salary) || hasRuleLines(base.lines) || incentive !== 0 || deduction !== 0;
    const before = parse(salary.calculation_details);
    const taxable = list => JSON.stringify(list.filter(item => Number(item.taxable)).map(item => item.amount));
    const hasTaxable = adjustments.some(item => Number(item.taxable));
    const currentTax = { taxType: salary.tax_type, taxAmount: parseFloat(salary.tax_amount) || 0, insuranceDetails: parse(salary.insurance_details) };
    // 세금 대상이 그대로면(인센티브만 고치거나 세금에 안 넣는 조정만 바꾸면) 지금 세금을, 세금 대상 조정을 모두 지우면 넣기 전 세금을 쓴다
    let kept = null;
    if (keepTax && taxable(before?.adjustments ?? []) === taxable(adjustments)) kept = currentTax;
    else if (keepTax && !hasTaxable) kept = before?.plain_tax ?? null;
    // 강사의 세금 유형이 바뀐 옛 급여 줄은 낡은 유형이 남아 있을 수 있다 — 다시 계산할 때는 강사 설정을 쓴다
    const taxType = kept ? kept.taxType : salary.instructor_tax_type || 'none';
    const result = totals({ ...base, incentive, deduction, adjustments, taxType, yearMonth: salary.year_month, mode, custom, keepTax: kept });
    // 음수로 만들거나 더 작게 만드는 것만 막는다(이미 음수인 달을 늘리는 수정은 된다)
    if (result.netSalary < 0 && !allowNegative && result.netSalary < (parseFloat(salary.net_salary) || 0)) throw negative(salary.year_month);
    const plainTax = { taxType, taxAmount: result.taxAmount, insuranceDetails: result.insuranceDetails };
    const details = {
        mode,
        plain_tax: !hasTaxable ? plainTax : !keepTax ? null : before?.plain_tax ?? (taxable(before?.adjustments ?? []) === '[]' ? currentTax : null),
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
async function recalculate(conn, salary, mode, options = {}) {
    const used = mode ?? await lastMode(conn, salary);
    return save(conn, salary, await computeBase(conn, salary, used), { ...options, mode: used });
}

// 규칙을 저장·삭제한 뒤: 규칙이 실제로 닿는(닿았던) 달만 다시 계산한다
async function recalculateIfRuled(conn, salary) {
    const mode = await lastMode(conn, salary);
    const base = await computeBase(conn, salary, mode);
    if (!hasRuleLines(base.lines) && !hasRuleLines(parse(salary.calculation_details)?.base_lines ?? [])) return false;
    await save(conn, salary, base, { mode });
    return true;
}

// 기본급은 그대로 두고 인센티브·공제·조정·세금·실수령액만 다시 맞춘다
async function refreshTotals(conn, salary, options = {}) {
    const details = parse(salary.calculation_details);
    const base = {
        baseAmount: parseFloat(salary.base_amount) || 0,
        nonTaxable: details?.non_taxable_base || 0,
        lines: details?.base_lines || []
    };
    return save(conn, salary, base, { ...options, mode: await lastMode(conn, salary), keepTax: true });
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
    // 출근 체크에서는 음수라도 저장한다(멈추면 틀린 금액이 남는다). 지급할 때 막는다
    return recalculate(conn, salary, mode, { allowNegative: true });
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
