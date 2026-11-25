/**
 * 강사 기간별 급여 규칙 — 저장·삭제·시즌 연결. 어느 강사든 쓸 수 있다.
 * 저장하면 그 규칙이 닿는 달의 미지급 급여만 다시 계산한다. 지급 완료된 급여와 그 달 분할액은 바꾸지 않는다.
 */
const { SLOTS, parseSlots, dateText, isPaymentOnly } = require('../utils/salaryBreakdown');
const { recalculateMonth, createInstallmentSalaries } = require('./salaryService');

const PAY_TYPES = ['per_class', 'monthly', 'daily', 'fixed_total'];
const fail = (status, error, message, extra = {}) => Object.assign(new Error(message), { status, body: { error, message, ...extra } });
const invalid = message => fail(400, 'VALIDATION_ERROR', message);
const isWon = value => Number.isSafeInteger(value) && value > 0 && value < 1e9;
const won = value => `${value.toLocaleString('ko-KR')}원`;

function dateOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const text = String(value).slice(0, 10);
    const date = new Date(`${text}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text || text < '2000-01-01') {
        throw invalid('날짜 형식이 올바르지 않습니다.');
    }
    return text;
}

// 입력을 다듬고 검사한다. 분할 합계가 총액과 다르면 confirm_mismatch 가 있어야 저장된다
function ruleInput(body) {
    const payType = body.pay_type;
    if (!PAY_TYPES.includes(payType)) throw invalid('급여 방식을 골라 주세요.');
    if (!isWon(body.amount)) throw invalid('금액은 1원 이상 원 단위 숫자로 입력해 주세요.');
    const start = dateOrNull(body.start_date);
    const end = dateOrNull(body.end_date);
    if (start && end && start > end) throw invalid('끝나는 날이 시작하는 날보다 빠릅니다.');
    const slots = body.time_slots === undefined ? SLOTS : body.time_slots;
    if (!Array.isArray(slots) || slots.length === 0 || slots.some(slot => !SLOTS.includes(slot))) throw invalid('시간대를 하나 이상 골라 주세요.');
    const memo = String(body.memo ?? '').trim();
    if (memo.length > 200) throw invalid('규칙 이름은 200자 안으로 적어 주세요.');

    const installments = payType === 'fixed_total' ? body.installments ?? [] : [];
    if (!Array.isArray(installments) || installments.length > 36) throw invalid('분할 일정을 확인해 주세요.');
    for (const item of installments) {
        if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(item.pay_year_month)) || !isWon(item.amount)) throw invalid('분할 지급 달과 금액을 확인해 주세요.');
    }
    if (new Set(installments.map(item => item.pay_year_month)).size !== installments.length) throw invalid('같은 달에 분할 지급을 두 번 넣을 수 없습니다.');
    const sum = installments.reduce((total, item) => total + item.amount, 0);
    if (payType === 'fixed_total' && sum !== body.amount && !body.confirm_mismatch) {
        throw fail(409, 'INSTALLMENT_MISMATCH', `분할 합계 ${won(sum)}이 총액 ${won(body.amount)}과 다릅니다.`, { installment_total: sum });
    }
    return {
        pay_type: payType, amount: body.amount, start_date: start, end_date: end,
        time_slots: SLOTS.filter(slot => slots.includes(slot)), taxable: body.taxable === false ? 0 : 1, memo: memo || null,
        installments: installments.map(item => ({ pay_year_month: item.pay_year_month, amount: item.amount }))
            .sort((a, b) => a.pay_year_month.localeCompare(b.pay_year_month))
    };
}

async function lockInstructor(conn, instructorId, academyId) {
    const [rows] = await conn.execute(
        'SELECT id, academy_id, salary_type FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL FOR UPDATE',
        [Number(instructorId) || 0, academyId]
    );
    if (!rows[0]) throw fail(404, 'NOT_FOUND', '강사 정보를 찾을 수 없습니다.');
    return rows[0];
}

async function lockRule(conn, ruleId, academyId) {
    const [rows] = await conn.execute(
        `SELECT r.* FROM instructor_pay_rules r JOIN instructors i ON i.id = r.instructor_id
         WHERE r.id = ? AND i.academy_id = ? FOR UPDATE`,
        [Number(ruleId) || 0, academyId]
    );
    if (!rows[0]) throw fail(404, 'NOT_FOUND', '급여 규칙을 찾을 수 없습니다.');
    return { ...rows[0], installments: await ruleInstallments(conn, [rows[0].id]) };
}

async function ruleInstallments(conn, ruleIds) {
    if (ruleIds.length === 0) return [];
    const [rows] = await conn.execute(
        `SELECT pay_rule_id, pay_year_month, amount FROM pay_rule_installments
         WHERE pay_rule_id IN (${ruleIds.map(() => '?').join(',')}) ORDER BY pay_year_month`,
        ruleIds
    );
    return rows;
}

// 같은 날짜·시간대에 규칙이 두 개면 어느 쪽을 따를지 알 수 없다
async function assertNoOverlap(conn, instructorId, rule, exceptId = 0) {
    if (isPaymentOnly(rule)) return;
    const [rows] = await conn.execute('SELECT * FROM instructor_pay_rules WHERE instructor_id = ? AND id <> ?', [instructorId, exceptId]);
    const range = item => [item.start_date ? dateText(item.start_date) : '0000-00-00', item.end_date ? dateText(item.end_date) : '9999-99-99'];
    const [start, end] = range(rule);
    const clash = rows.find(other => {
        if (isPaymentOnly(other)) return false;
        const [otherStart, otherEnd] = range(other);
        return start <= otherEnd && otherStart <= end && parseSlots(other.time_slots).some(slot => rule.time_slots.includes(slot));
    });
    if (clash) throw fail(409, 'RULE_OVERLAP', `같은 날짜·시간대에 이미 규칙이 있습니다(${clash.memo || `${range(clash).join(' ~ ')}`}).`);
}

// 이미 지급한 달의 분할액은 더하거나 빼거나 바꿀 수 없다
async function assertPaidMonthsKept(conn, instructorId, before, after) {
    const amounts = list => new Map(list.map(item => [item.pay_year_month, Number(item.amount)]));
    const [old, next] = [amounts(before), amounts(after)];
    const changed = [...new Set([...old.keys(), ...next.keys()])].filter(month => old.get(month) !== next.get(month));
    if (changed.length === 0) return;
    const [paid] = await conn.execute(
        `SELECT \`year_month\` FROM salary_records WHERE instructor_id = ? AND payment_status = 'paid'
         AND \`year_month\` IN (${changed.map(() => '?').join(',')})`,
        [instructorId, ...changed]
    );
    if (paid.length > 0) throw fail(409, 'MONTH_PAID', `이미 지급 완료된 달(${paid.map(row => row.year_month).join(', ')})의 분할 지급은 바꿀 수 없습니다.`);
}

async function writeInstallments(conn, ruleId, installments) {
    await conn.execute('DELETE FROM pay_rule_installments WHERE pay_rule_id = ?', [ruleId]);
    for (const item of installments) {
        await conn.execute('INSERT INTO pay_rule_installments (pay_rule_id, pay_year_month, amount) VALUES (?, ?, ?)', [ruleId, item.pay_year_month, item.amount]);
    }
}

// 규칙(바꾸기 전·후)이 닿는 달의 미지급 급여를 다시 계산하고, 이번 달까지의 분할 지급 달에 급여 줄이 없으면 만든다
async function refreshSalaries(conn, instructor, rules) {
    const [pending] = await conn.execute(
        "SELECT `year_month` FROM salary_records WHERE instructor_id = ? AND COALESCE(payment_status, 'pending') <> 'paid' ORDER BY `year_month`",
        [instructor.id]
    );
    const touches = month => rules.some(rule => rule.installments.some(item => item.pay_year_month === month)
        || (!isPaymentOnly(rule)
            && (!rule.start_date || dateText(rule.start_date).slice(0, 7) <= month)
            && (!rule.end_date || month <= dateText(rule.end_date).slice(0, 7))));
    const months = pending.map(row => row.year_month).filter(touches);
    for (const yearMonth of months) {
        await recalculateMonth(conn, { instructorId: instructor.id, academyId: instructor.academy_id, yearMonth, create: false });
    }
    await createInstallmentSalaries(conn, { instructorId: instructor.id });
    return months;
}

async function createRule(conn, { academyId, userId, instructorId, seasonId = null, rule }) {
    const instructor = await lockInstructor(conn, instructorId, academyId);
    if (instructor.salary_type === 'monthly' && rule.pay_type !== 'fixed_total') throw invalid('월급 강사는 고정급 규칙만 넣을 수 있습니다. 기본 월급은 그대로 지급됩니다.');
    await assertNoOverlap(conn, instructor.id, rule);
    await assertPaidMonthsKept(conn, instructor.id, [], rule.installments);
    const [result] = await conn.execute(
        `INSERT INTO instructor_pay_rules (instructor_id, season_id, start_date, end_date, pay_type, amount, time_slots, taxable, memo, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [instructor.id, seasonId, rule.start_date, rule.end_date, rule.pay_type, rule.amount, JSON.stringify(rule.time_slots), rule.taxable, rule.memo, userId ?? null]
    );
    await writeInstallments(conn, result.insertId, rule.installments);
    return { id: result.insertId, recalculated_months: await refreshSalaries(conn, instructor, [rule]) };
}

async function updateRule(conn, { academyId, ruleId, rule }) {
    const before = await lockRule(conn, ruleId, academyId);
    const instructor = await lockInstructor(conn, before.instructor_id, academyId);
    if (instructor.salary_type === 'monthly' && rule.pay_type !== 'fixed_total') throw invalid('월급 강사는 고정급 규칙만 넣을 수 있습니다. 기본 월급은 그대로 지급됩니다.');
    await assertNoOverlap(conn, instructor.id, rule, before.id);
    await assertPaidMonthsKept(conn, instructor.id, before.installments, rule.installments);
    await conn.execute(
        `UPDATE instructor_pay_rules SET start_date = ?, end_date = ?, pay_type = ?, amount = ?, time_slots = ?, taxable = ?, memo = ? WHERE id = ?`,
        [rule.start_date, rule.end_date, rule.pay_type, rule.amount, JSON.stringify(rule.time_slots), rule.taxable, rule.memo, before.id]
    );
    await writeInstallments(conn, before.id, rule.installments);
    return { id: before.id, recalculated_months: await refreshSalaries(conn, instructor, [before, rule]) };
}

async function deleteRule(conn, { academyId, ruleId }) {
    const before = await lockRule(conn, ruleId, academyId);
    const instructor = await lockInstructor(conn, before.instructor_id, academyId);
    await assertPaidMonthsKept(conn, instructor.id, before.installments, []);
    await conn.execute('DELETE FROM instructor_pay_rules WHERE id = ?', [before.id]);
    return { id: before.id, recalculated_months: await refreshSalaries(conn, instructor, [before]) };
}

async function listRules(conn, academyId, { instructorId = null, seasonId = null }) {
    const [rows] = await conn.execute(
        `SELECT r.*, i.name AS instructor_name, se.season_name FROM instructor_pay_rules r
         JOIN instructors i ON i.id = r.instructor_id LEFT JOIN seasons se ON se.id = r.season_id
         WHERE i.academy_id = ? ${instructorId ? 'AND r.instructor_id = ?' : ''} ${seasonId ? 'AND r.season_id = ?' : ''}
         ORDER BY r.start_date IS NULL, r.start_date, r.id`,
        [academyId, ...(instructorId ? [instructorId] : []), ...(seasonId ? [seasonId] : [])]
    );
    const installments = await ruleInstallments(conn, rows.map(row => row.id));
    return rows.map(row => ({ ...row, time_slots: parseSlots(row.time_slots), taxable: Boolean(Number(row.taxable)),
        installments: installments.filter(item => item.pay_rule_id === row.id).map(({ pay_year_month, amount }) => ({ pay_year_month, amount })) }));
}

async function findSeason(conn, seasonId, academyId) {
    const [rows] = await conn.execute('SELECT id, season_name, season_start_date, season_end_date FROM seasons WHERE id = ? AND academy_id = ?',
        [Number(seasonId) || 0, academyId]);
    if (!rows[0]) throw fail(404, 'NOT_FOUND', '시즌을 찾을 수 없습니다.');
    return rows[0];
}

// 시즌 강사 여러 명에게 같은 고정급 규칙을 만든다. 날짜를 비우면 시즌 기간
async function createSeasonRules(conn, { academyId, userId, seasonId, body }) {
    const season = await findSeason(conn, seasonId, academyId);
    const ids = [...new Set((Array.isArray(body.instructor_ids) ? body.instructor_ids : []).map(Number))];
    if (ids.length === 0) throw invalid('시즌 강사를 한 명 이상 골라 주세요.');
    const rule = ruleInput({ ...body, pay_type: 'fixed_total',
        start_date: body.start_date || dateText(season.season_start_date), end_date: body.end_date || dateText(season.season_end_date) });
    const created = [];
    for (const instructorId of ids.sort((a, b) => a - b)) {
        created.push((await createRule(conn, { academyId, userId, instructorId, seasonId: season.id, rule })).id);
    }
    return created;
}

// 시즌 기간이 바뀐 뒤 연결된 규칙의 기간을 맞춘다
async function syncSeasonRules(conn, { academyId, seasonId, ruleIds }) {
    const season = await findSeason(conn, seasonId, academyId);
    const updated = [];
    for (const ruleId of ruleIds) {
        const before = await lockRule(conn, ruleId, academyId);
        if (before.season_id !== season.id) throw fail(404, 'NOT_FOUND', '이 시즌의 급여 규칙이 아닙니다.');
        const rule = { ...before, time_slots: parseSlots(before.time_slots), start_date: dateText(season.season_start_date), end_date: dateText(season.season_end_date) };
        updated.push((await updateRule(conn, { academyId, ruleId: before.id, rule })).id);
    }
    return updated;
}

module.exports = { ruleInput, createRule, updateRule, deleteRule, listRules, createSeasonRules, syncSeasonRules };
