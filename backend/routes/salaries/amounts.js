/**
 * Salaries Amounts Sub-Router — 사람이 금액을 정하는 경로. 지급 완료된 급여는 모두 막는다.
 *   - POST   /open                          : 출근이 없는 달 명세서 만들기 { instructor_id, year_month }
 *   - PUT    /:id                           : 인센티브·공제·지급 상태(예전과 같음) + base_override(기본급 직접 입력, null = 자동)
 *   - POST   /:id/adjustments               : 조정 추가 { label, amount, taxable, memo } 또는 실수령액 맞추기 { label, target_net, memo }
 *   - PUT    /:id/adjustments/:adjustmentId : 조정 수정
 *   - DELETE /:id/adjustments/:adjustmentId : 조정 삭제
 */
const { pool, verifyToken, requireRole, logger, decryptInstructorName } = require('./_utils');
const { lockSalary, createEmptySalary, lockSalaryByMonth, listAdjustments } = require('../../repositories/salaryRepository');
const { inTransaction, isPaid, recalculate, refreshTotals } = require('../../services/salaryService');

const LIMIT = 1e9;
const isWon = value => Number.isSafeInteger(value) && Math.abs(value) < LIMIT;
const fail = (status, error, message) => Object.assign(new Error(message), { status, body: { error, message } });

function send(res, error, code, message) {
    if (error.status) return res.status(error.status).json(error.body);
    logger.error(`${code}:`, error);
    return res.status(500).json({ error: code, message });
}

function adjustmentInput({ label, amount, taxable = true, memo = null }) {
    const text = String(label ?? '').trim();
    if (!text || text.length > 100) throw fail(400, 'VALIDATION_ERROR', '항목명을 100자 안으로 적어 주세요.');
    if (!isWon(amount) || amount === 0) throw fail(400, 'VALIDATION_ERROR', '조정 금액은 0이 아닌 원 단위 숫자로 입력해 주세요.');
    if (memo !== null && String(memo).length > 500) throw fail(400, 'VALIDATION_ERROR', '메모는 500자 안으로 적어 주세요.');
    return { label: text, amount, taxable: taxable ? 1 : 0, memo: memo ? String(memo) : null };
}

async function editableSalary(conn, req) {
    const salary = await lockSalary(conn, parseInt(req.params.id), req.user.academyId);
    if (!salary) throw fail(404, 'NOT_FOUND', '급여 기록을 찾을 수 없습니다.');
    if (isPaid(salary)) throw fail(400, 'SALARY_PAID', '지급 완료된 급여는 바꿀 수 없습니다.');
    return salary;
}

// 조정을 바꾼 뒤 세금·실수령액을 다시 맞춘다(실수령액이 0원보다 작아지면 오류로 되돌아간다)
async function settle(conn, salary) {
    const result = await refreshTotals(conn, salary);
    return { net_salary: result.netSalary, tax_amount: result.taxAmount, adjustment_amount: result.adjustmentAmount,
        adjustments: await listAdjustments(conn, salary.id) };
}

// 실수령액 맞추기: 지금 기준으로 다시 맞춘 실수령액과의 차이만큼 세금에 넣지 않는 조정을 만든다
async function matchInput(conn, salary, { target_net: target, label, memo }) {
    if (!isWon(target) || target < 0 || target % 10 !== 0) throw fail(400, 'VALIDATION_ERROR', '실수령액은 10원 단위로 입력해 주세요.');
    const current = Math.floor((await refreshTotals(conn, salary, { allowNegative: true })).netSalary / 10) * 10;
    if (target === current) throw fail(400, 'VALIDATION_ERROR', '지금 실수령액과 같습니다.');
    return adjustmentInput({ label, memo, amount: target - current, taxable: false });
}

async function findAdjustment(conn, salary, req) {
    const [rows] = await conn.execute('SELECT * FROM salary_adjustments WHERE id = ? AND salary_record_id = ?',
        [parseInt(req.params.adjustmentId), salary.id]);
    if (!rows[0]) throw fail(404, 'NOT_FOUND', '조정 항목을 찾을 수 없습니다.');
    return rows[0];
}

module.exports = function(router) {
    router.post('/open', verifyToken, requireRole('owner'), async (req, res) => {
        try {
            const { instructor_id, year_month } = req.body;
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(year_month))) throw fail(400, 'VALIDATION_ERROR', '급여월을 YYYY-MM 으로 골라 주세요.');
            const salary = await inTransaction(pool, async conn => {
                const [[instructor]] = await conn.execute(
                    'SELECT id, tax_type FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                    [Number(instructor_id) || 0, req.user.academyId]
                );
                if (!instructor) throw fail(404, 'NOT_FOUND', '강사 정보를 찾을 수 없습니다.');
                const existing = await lockSalaryByMonth(conn, instructor.id, year_month);
                if (existing) return existing;
                await createEmptySalary(conn, instructor.id, year_month, instructor.tax_type);
                const created = await lockSalaryByMonth(conn, instructor.id, year_month);
                await recalculate(conn, created, 'recalc');
                return created;
            });
            res.status(201).json({ message: '급여 명세서를 열었습니다.', salary: { id: salary.id } });
        } catch (error) {
            send(res, error, 'OPEN_SALARY_FAILED', '급여 명세서를 만들지 못했습니다.');
        }
    });

    router.put('/:id', verifyToken, requireRole('owner'), async (req, res) => {
        const salaryId = parseInt(req.params.id);
        try {
            const updated = await inTransaction(pool, async conn => {
                const salary = await editableSalary(conn, req);
                const { incentive_amount, total_deduction, payment_status, payment_date, base_override } = req.body;
                const values = { incentive_amount, total_deduction, payment_status, payment_date, base_override };
                const keys = Object.keys(values).filter(key => values[key] !== undefined);
                if (keys.length === 0) throw fail(400, 'VALIDATION_ERROR', '수정할 항목이 없습니다.');
                // 지급은 지출 기록을 남기는 지급 처리(/pay)로만 한다
                if (payment_status === 'paid') throw fail(400, 'VALIDATION_ERROR', '지급은 지급 완료 버튼으로 처리해 주세요.');
                if (payment_status !== undefined && [incentive_amount, total_deduction, base_override].some(value => value !== undefined)) {
                    throw fail(400, 'VALIDATION_ERROR', '금액과 지급 상태를 한 번에 바꿀 수 없습니다.');
                }
                if (base_override !== undefined && base_override !== null && (!isWon(base_override) || base_override < 0)) {
                    throw fail(400, 'VALIDATION_ERROR', '기본급은 0원 이상 원 단위 숫자로 입력해 주세요.');
                }
                await conn.execute(
                    `UPDATE salary_records SET ${keys.map(key => `${key} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`,
                    [...keys.map(key => values[key]), salaryId]
                );
                const next = { ...salary, ...Object.fromEntries(keys.map(key => [key, values[key]])), payment_status: salary.payment_status };
                // 상태만 바꾸는 요청은 금액을 다시 계산하지 않는다
                if (base_override !== undefined) await recalculate(conn, next);
                else if (incentive_amount !== undefined || total_deduction !== undefined) await refreshTotals(conn, next, { floorNet: true });
                const [[row]] = await conn.execute(
                    `SELECT s.*, i.name as instructor_name FROM salary_records s JOIN instructors i ON s.instructor_id = i.id WHERE s.id = ?`,
                    [salaryId]
                );
                return row;
            });
            res.json({ message: '급여 기록이 수정되었습니다.', salary: decryptInstructorName(updated) });
        } catch (error) {
            send(res, error, 'UPDATE_SALARY_FAILED', '급여 기록 수정에 실패했습니다.');
        }
    });

    router.post('/:id/adjustments', verifyToken, requireRole('owner'), async (req, res) => {
        try {
            const matching = req.body.target_net !== undefined;
            const input = matching ? null : adjustmentInput(req.body);
            const result = await inTransaction(pool, async conn => {
                const salary = await editableSalary(conn, req);
                const adjustment = matching ? await matchInput(conn, salary, req.body) : input;
                await conn.execute(
                    'INSERT INTO salary_adjustments (salary_record_id, label, amount, taxable, memo, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                    [salary.id, adjustment.label, adjustment.amount, adjustment.taxable, adjustment.memo, req.user.userId ?? null]
                );
                return settle(conn, salary);
            });
            res.status(201).json({ message: '조정 항목을 추가했습니다.', ...result });
        } catch (error) {
            send(res, error, 'ADJUSTMENT_FAILED', '조정 항목을 저장하지 못했습니다.');
        }
    });

    router.put('/:id/adjustments/:adjustmentId', verifyToken, requireRole('owner'), async (req, res) => {
        try {
            const input = adjustmentInput(req.body);
            const result = await inTransaction(pool, async conn => {
                const salary = await editableSalary(conn, req);
                const adjustment = await findAdjustment(conn, salary, req);
                await conn.execute('UPDATE salary_adjustments SET label = ?, amount = ?, taxable = ?, memo = ? WHERE id = ?',
                    [input.label, input.amount, input.taxable, input.memo, adjustment.id]);
                return settle(conn, salary);
            });
            res.json({ message: '조정 항목을 수정했습니다.', ...result });
        } catch (error) {
            send(res, error, 'ADJUSTMENT_FAILED', '조정 항목을 저장하지 못했습니다.');
        }
    });

    router.delete('/:id/adjustments/:adjustmentId', verifyToken, requireRole('owner'), async (req, res) => {
        try {
            const result = await inTransaction(pool, async conn => {
                const salary = await editableSalary(conn, req);
                const adjustment = await findAdjustment(conn, salary, req);
                await conn.execute('DELETE FROM salary_adjustments WHERE id = ?', [adjustment.id]);
                return settle(conn, salary);
            });
            res.json({ message: '조정 항목을 삭제했습니다.', ...result });
        } catch (error) {
            send(res, error, 'ADJUSTMENT_FAILED', '조정 항목을 삭제하지 못했습니다.');
        }
    });
};
