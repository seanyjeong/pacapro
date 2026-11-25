/**
 * 급여 계산 — 출근 체크 자동 계산, 재계산 버튼, 인센티브·조정 저장이 모두 이 계산을 쓴다.
 * DB 를 읽지 않는다. 금액은 원 단위 정수.
 * - buildBase: 출근 기록 + 강사 기본 급여 + 기간별 규칙 + 분할 지급액 → 기본급과 줄 단위 내역
 * - totals: 기본급 + 인센티브 − 공제 + 조정 − 세금 → 실수령액
 * mode 'auto'(출근 체크)와 'recalc'(재계산·조정)는 예전부터 반올림·시급 시간·혼합 급여 처리가 다르다.
 * 규칙·조정이 없는 강사의 금액을 바꾸지 않으려고 그 차이를 그대로 둔다(사장님 결정 2026-11-26).
 */
const { calculate4Insurance } = require('./socialInsuranceCalculator');

const SLOTS = ['morning', 'afternoon', 'evening'];
const SLOT_LABELS = { morning: '오전', afternoon: '오후', evening: '저녁' };
const won = value => `${Math.round(value).toLocaleString('ko-KR')}원`;
const number = value => parseFloat(value) || 0;
const dateText = value => (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
const shortDate = date => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

function period(dates) {
    const sorted = [...dates].sort();
    const [first, last] = [shortDate(sorted[0]), shortDate(sorted.at(-1))];
    return first === last ? first : `${first}~${last}`;
}

function parseSlots(value) {
    const slots = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(slots) ? slots : SLOTS;
}

function slotText(slots) {
    return SLOTS.every(slot => slots.includes(slot)) ? '시간대 무관' : SLOTS.filter(slot => slots.includes(slot)).map(slot => SLOT_LABELS[slot]).join('·');
}

function ruleName(rule) {
    return rule.season_name || rule.memo || '';
}

// 날짜 없이 금액만 지급하는 고정급 — 출근 계산에는 손대지 않는다
function isPaymentOnly(rule) {
    return rule.pay_type === 'fixed_total' && !rule.start_date && !rule.end_date;
}

function findRule(rules, date, slot) {
    return rules.find(rule => (!rule.start_date || dateText(rule.start_date) <= date)
        && (!rule.end_date || date <= dateText(rule.end_date))
        && !isPaymentOnly(rule) && parseSlots(rule.time_slots).includes(slot)) || null;
}

// 예전 계산과 1원까지 같게: 출근 체크는 분을 모아 나누고, 재계산은 기록마다 나눠 더하며 시각이 없으면 3시간으로 친다
function hoursOf(attendances, mode) {
    let minutes = 0;
    let hours = 0;
    for (const { check_in_time: start, check_out_time: end } of attendances) {
        if (!start || !end) {
            hours += 3;
            continue;
        }
        const [inH, inM] = start.split(':').map(Number);
        const [outH, outM] = end.split(':').map(Number);
        const worked = outH * 60 + outM - inH * 60 - inM;
        if (worked <= 0) continue;
        minutes += worked;
        hours += worked / 60;
    }
    return mode === 'auto' ? minutes / 60 : hours;
}

function classLines(instructor, attendances) {
    const fallback = number(instructor.hourly_rate);
    const groups = new Map();
    for (const att of attendances) {
        const rate = number(instructor[`${att.time_slot}_class_rate`]) || fallback;
        if (!groups.has(rate)) groups.set(rate, []);
        groups.get(rate).push(att);
    }
    return [...groups].map(([rate, list]) => {
        const slots = SLOTS.filter(slot => list.some(att => att.time_slot === slot));
        const name = groups.size === 1 ? '수업당' : slots.map(slot => SLOT_LABELS[slot]).join('·');
        return { kind: 'class', label: `${name} ${won(rate)} × ${list.length}회 (${period(list.map(att => att.date))})`, amount: rate * list.length };
    });
}

function ruleLines(rule, attendances) {
    const name = ruleName(rule);
    const prefix = name ? `${name} ` : '';
    const slots = slotText(parseSlots(rule.time_slots));
    const amount = number(rule.amount);
    if (rule.pay_type === 'monthly') {
        return [{ kind: 'rule', rule_id: rule.id, label: `${prefix}월급 규칙`, amount }];
    }
    if (attendances.length === 0) return [];
    const dates = attendances.map(att => att.date);
    const range = period(dates);
    if (rule.pay_type === 'fixed_total') {
        return [{ kind: 'excluded', rule_id: rule.id, label: `${prefix}고정급 규칙 적용 ${attendances.length}회 (${range}, ${slots})`, amount: 0 }];
    }
    if (rule.pay_type === 'daily') {
        const days = new Set(dates).size;
        return [{ kind: 'rule', rule_id: rule.id, label: `${prefix}하루 ${won(amount)} × ${days}일 (${range}, ${slots})`, amount: amount * days }];
    }
    return [{ kind: 'rule', rule_id: rule.id, label: `${prefix}수업당 ${won(amount)} × ${attendances.length}회 (${range}, ${slots})`, amount: amount * attendances.length }];
}

// 기본 급여유형대로 센 줄을 더하고 시급 근무 시간을 돌려준다
function addWorkLines(lines, { instructor, monthly, rest, mode }) {
    if (monthly || instructor.salary_type === 'mixed') {
        lines.push({ kind: 'base', label: '기본 월급', amount: number(instructor.base_salary) });
    }
    if (instructor.salary_type === 'per_class' || instructor.salary_type === 'mixed') lines.push(...classLines(instructor, rest));
    if (instructor.salary_type !== 'hourly') return 0;
    const hours = hoursOf(rest, mode);
    const amount = number(instructor.hourly_rate) * hours;
    if (rest.length > 0) {
        lines.push({ kind: 'hourly', label: `시급 ${won(number(instructor.hourly_rate))} × ${Math.round(hours * 100) / 100}시간`,
            amount: mode === 'auto' ? Math.round(amount) : amount });
    }
    return hours;
}

/**
 * instructor: 강사 행, attendances: 그 달 출근(present·late), rules: 그 달에 걸리는 규칙(season_name 포함),
 * installments: 그 달 분할 지급액 [{ rule_id, season_name, memo, taxable, amount, sequence, count }]
 */
function buildBase({ instructor, attendances, rules = [], installments = [], override = null, mode = 'recalc' }) {
    const list = attendances.map(att => ({ ...att, date: dateText(att.work_date) }));
    const counts = Object.fromEntries(SLOTS.map(slot => [slot, list.filter(att => att.time_slot === slot).length]));
    const monthly = instructor.salary_type === 'monthly';
    // 월급 강사는 기본 월급 그대로 두고 분할 지급액만 더한다
    const activeRules = monthly ? [] : rules;
    const byRule = new Map(activeRules.map(rule => [rule.id, []]));
    const rest = [];
    for (const att of list) {
        const rule = findRule(activeRules, att.date, att.time_slot);
        if (rule) byRule.get(rule.id).push(att);
        else rest.push(att);
    }

    const lines = [];
    let totalHours = 0;
    const ruled = installments.length > 0 || activeRules.some(rule => rule.pay_type === 'monthly' || byRule.get(rule.id).length > 0);
    const plainAuto = mode === 'auto' && !ruled;
    if (override !== null && override !== undefined) {
        lines.push({ kind: 'override', label: '기본급 직접 입력', amount: Number(override) });
    } else if (instructor.salary_type === 'mixed' && plainAuto) {
        // 혼합 급여는 출근 체크 때 0원, 재계산 때 계산한다(지금까지와 같음)
    } else {
        totalHours = addWorkLines(lines, { instructor, monthly, rest, mode });
        for (const rule of activeRules) lines.push(...ruleLines(rule, byRule.get(rule.id)));
    }
    for (const item of installments) {
        const name = ruleName(item);
        lines.push({ kind: 'installment', rule_id: item.rule_id, label: `${name ? `${name} ` : ''}고정급 (${item.sequence}/${item.count})`,
            amount: number(item.amount), taxable: Boolean(Number(item.taxable ?? 1)) });
    }
    const baseAmount = lines.reduce((sum, line) => sum + line.amount, 0);
    const nonTaxable = lines.filter(line => line.taxable === false).reduce((sum, line) => sum + line.amount, 0);
    return { lines, baseAmount, nonTaxable, counts, totalHours };
}

/**
 * 세금: 3.3% 는 (기본급 + 세금 대상 조정), 4대보험은 재계산에서 인센티브·공제까지 넣은 금액 — 지금까지와 같은 기준에 조정만 더했다.
 * 실수령액은 재계산이거나 조정·규칙·직접 입력이 있으면 10원 미만을 버린다(실수령액 맞추기가 다음 출근 체크 뒤에도 맞게).
 */
function totals({ baseAmount, nonTaxable = 0, incentive = 0, deduction = 0, adjustments = [], taxType, yearMonth, mode = 'recalc', custom = false, keepTax = null }) {
    const adjustmentAmount = adjustments.reduce((sum, item) => sum + Number(item.amount), 0);
    const taxableAdjustment = adjustments.filter(item => Number(item.taxable)).reduce((sum, item) => sum + Number(item.amount), 0);
    const taxableBase = baseAmount - nonTaxable + taxableAdjustment;
    let taxAmount = 0;
    let insuranceDetails = null;
    if (keepTax) {
        ({ taxAmount, insuranceDetails } = keepTax);
    } else if (taxType === '3.3%') {
        const tax = Math.max(0, taxableBase) * 0.033;
        taxAmount = mode === 'auto' ? Math.round(tax) : Math.floor(tax);
    } else if (taxType === 'insurance') {
        insuranceDetails = calculate4Insurance(mode === 'auto' ? taxableBase : taxableBase + incentive - deduction, yearMonth);
        taxAmount = insuranceDetails.totalDeduction;
    }
    const net = baseAmount + incentive - deduction + adjustmentAmount - taxAmount;
    const netSalary = mode === 'auto' && !custom ? net : Math.floor(net / 10) * 10;
    return { adjustmentAmount, taxableAmount: taxableBase, taxAmount, insuranceDetails, netSalary };
}

module.exports = { SLOTS, buildBase, totals, findRule, parseSlots, dateText, isPaymentOnly };
