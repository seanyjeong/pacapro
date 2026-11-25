/**
 * 급여 조정·기간별 규칙·분할 지급을 일회용 MySQL 8 에서 실제 라우트로 돌린다(마이그레이션 적용, 되돌리기 포함).
 * RUN_MAX_ENGINE_MYSQL=1 TEST_MYSQL_PORT=<10000 이상 전용 포트> 일 때만 돈다. 운영 자격 증명·실제 강사 없음.
 */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => ({
    execute: (...args) => global.__salaryDb.execute(...args),
    query: (...args) => global.__salaryDb.query(...args),
    getConnection: (...args) => global.__salaryDb.getConnection(...args),
}));
jest.mock('../../middleware/auth', () => ({
    verifyToken: (req, _res, next) => { req.user = { academyId: Number(req.headers['x-academy'] || 1), userId: 1, role: 'owner' }; next(); },
    checkPermission: () => (_req, _res, next) => next(),
    requireRole: () => (_req, _res, next) => next(),
}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../utils/encryption', () => ({ decrypt: value => value, encrypt: value => value }));

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const express = require('express');
const request = require('supertest');
const schema = require('./max-engine-schema.json');
const { calculate4Insurance } = require('../../utils/socialInsuranceCalculator');

const database = 'salary_rules_mysql_test';
const NEW_COLUMNS = ['adjustment_amount', 'base_override', 'calculation_details'];
const ALL = ['morning', 'afternoon', 'evening'];
const migration = name => fs.readFileSync(path.join(__dirname, '../../migrations', name), 'utf8')
    .replace(/^--.*$/gm, '').split(';').filter(statement => statement.trim());

// 바꾸기 전 계산(출근 체크 자동 / 재계산 버튼) — 규칙·조정이 없으면 이 값과 1원까지 같아야 한다
function legacy(instructor, attendances, yearMonth, mode) {
    const n = value => parseFloat(value) || 0;
    const count = slot => attendances.filter(a => a.time_slot === slot).length;
    const classes = () => ALL.reduce((sum, slot) => sum + count(slot) * (n(instructor[`${slot}_class_rate`]) || n(instructor.hourly_rate)), 0);
    let base = 0;
    if (instructor.salary_type === 'hourly') {
        let hours = 0;
        for (const a of attendances) {
            if (a.check_in_time && a.check_out_time) {
                const [ih, im] = a.check_in_time.split(':').map(Number);
                const [oh, om] = a.check_out_time.split(':').map(Number);
                hours += Math.max(0, oh * 60 + om - ih * 60 - im) / 60;
            } else if (mode === 'recalc') hours += 3;
        }
        base = mode === 'auto' ? Math.round(hours * n(instructor.hourly_rate)) : n(instructor.hourly_rate) * hours;
    } else if (instructor.salary_type === 'per_class') base = classes();
    else if (instructor.salary_type === 'monthly') base = n(instructor.base_salary);
    else if (mode === 'recalc') base = classes() + n(instructor.base_salary);
    let tax = 0;
    if (instructor.tax_type === '3.3%') tax = mode === 'auto' ? Math.round(base * 0.033) : Math.floor(base * 0.033);
    else if (instructor.tax_type === 'insurance') tax = calculate4Insurance(base, yearMonth).totalDeduction;
    return { base, tax, net: mode === 'auto' ? base - tax : Math.floor((base - tax) / 10) * 10 };
}

run('급여 조정·규칙 — 실제 MySQL 8', () => {
    let admin, pool, app;
    const q = async (sql, params) => (await pool.query(sql, params))[0];
    const one = async (sql, params) => (await q(sql, params))[0];
    const salaryOf = (instructorId, month) => one('SELECT * FROM salary_records WHERE instructor_id = ? AND `year_month` = ?', [instructorId, month]);
    const details = salary => (typeof salary.calculation_details === 'string' ? JSON.parse(salary.calculation_details) : salary.calculation_details);
    const { updateSalaryFromAttendance } = require('../../utils/salaryCalculator');

    async function attend(instructorId, date, slots, status = 'present') {
        for (const slot of slots) {
            await q('INSERT INTO instructor_attendance (instructor_id, work_date, time_slot, attendance_status) VALUES (?, ?, ?, ?)', [instructorId, date, slot, status]);
            await updateSalaryFromAttendance(pool, instructorId, 1, date, status);
        }
    }
    const YEONYO = 319, CHEOLMIN = 2, SEONGJUN = 1, OTHER = 90;
    async function november() {
        for (const day of ['02', '04', '05', '06', '07', '09', '11', '13', '20']) await attend(YEONYO, `2026-11-${day}`, ['evening']);
        for (const day of ['23', '24', '25']) await attend(YEONYO, `2026-11-${day}`, ['morning', 'afternoon']);
        await attend(YEONYO, '2026-11-25', ['evening']);
        await attend(CHEOLMIN, '2026-11-02', ['evening']);
        await attend(SEONGJUN, '2026-11-02', ['evening']);
    }
    const season = (instructorId, extra = {}) => ({ instructor_id: instructorId, pay_type: 'fixed_total', amount: 3000000, start_date: '2026-11-23', end_date: '2027-01-31',
        time_slots: ALL, memo: '정시 시즌', installments: [{ pay_year_month: '2026-12', amount: 1500000 }, { pay_year_month: '2027-01', amount: 1500000 }], ...extra });
    const post = (url, body, academy = 1) => request(app).post(url).set('x-academy', String(academy)).send(body);

    beforeAll(async () => {
        const port = Number(process.env.TEST_MYSQL_PORT);
        if (!Number.isSafeInteger(port) || port < 10000) throw new Error('Dedicated TEST_MYSQL_PORT >=10000 required');
        const options = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true };
        admin = await mysql.createConnection(options);
        await admin.query(`DROP DATABASE IF EXISTS ${database}`);
        await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);
        await admin.query(`USE ${database}`);
        for (const table of ['instructors', 'seasons', 'salary_records', 'instructor_attendance', 'expenses']) {
            const defs = schema[`paca.${table}`].filter(([col]) => !(table === 'salary_records' && NEW_COLUMNS.includes(col)))
                .map(([col, type, nullable]) => `\`${col}\` ${type} ${col === 'id' ? 'NOT NULL AUTO_INCREMENT PRIMARY KEY' : nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
            await admin.query(`CREATE TABLE \`${table}\` (${defs.join(',')}) ENGINE=InnoDB`);
        }
        await admin.query('ALTER TABLE salary_records ADD UNIQUE KEY uk_instructor_salary (instructor_id, `year_month`)');
        // 되돌리기가 되는지까지: 적용 → 되돌리기 → 다시 적용 두 번(두 번째는 아무 일도 없어야 한다)
        for (const file of ['', '.down', '', '']) for (const statement of migration(`20261126_add_salary_rules${file}.mysql`)) await admin.query(statement);
        pool = mysql.createPool({ ...options, database });
        global.__salaryDb = pool;
        app = express(); app.use(express.json());
        app.use('/salaries', require('../../routes/salaries'));
        app.use('/rules', require('../../routes/payRules'));
    });
    afterAll(async () => { await pool?.end(); await admin?.end(); });

    beforeEach(async () => {
        for (const table of ['pay_rule_installments', 'instructor_pay_rules', 'salary_adjustments', 'salary_records', 'instructor_attendance', 'expenses', 'seasons', 'instructors']) await q(`DELETE FROM ${table}`);
        const base = { academy_id: 1, name: '합성', base_salary: 0, hourly_rate: 0, morning_class_rate: 0, afternoon_class_rate: 0, evening_class_rate: 0 };
        for (const row of [
            { id: SEONGJUN, salary_type: 'monthly', base_salary: 2500000, tax_type: 'insurance' },
            { id: CHEOLMIN, salary_type: 'monthly', base_salary: 1200000, hourly_rate: 40000, tax_type: '3.3%' },
            { id: YEONYO, salary_type: 'per_class', hourly_rate: 35000, tax_type: 'none' },
            { id: OTHER, academy_id: 2, salary_type: 'per_class', hourly_rate: 35000, tax_type: 'none' },
        ]) await q('INSERT INTO instructors SET ?', { ...base, ...row });
        await q('INSERT INTO seasons SET ?', { id: 21, academy_id: 1, season_name: '2027 정시집중', season_type: 'regular', season_start_date: '2026-11-23', season_end_date: '2027-01-29', non_season_end_date: '2026-11-20', operating_days: '[1]', default_season_fee: 0 });
    });

    test('강연요 11월: 9회 × 35,000 = 315,000원, 시즌 7회는 0원, 12월·1월에 +1,500,000원', async () => {
        await november();
        expect(Number((await salaryOf(YEONYO, '2026-11')).net_salary)).toBe(560000);
        expect((await post('/rules', season(YEONYO))).status).toBe(201);
        const nov = await salaryOf(YEONYO, '2026-11');
        expect([Number(nov.base_amount), Number(nov.tax_amount), Number(nov.net_salary)]).toEqual([315000, 0, 315000]);
        expect(details(nov).base_lines.map(line => [line.label, line.amount])).toEqual([
            ['수업당 35,000원 × 9회 (11/2~11/20)', 315000],
            ['정시 시즌 고정급 규칙 적용 7회 (11/23~11/25, 시간대 무관)', 0],
        ]);
        // 출근이 없어도 그 달 명세서에 줄이 붙는다
        const { createInstallmentSalaries } = require('../../services/salaryService');
        const { lockSalaryByMonth } = require('../../repositories/salaryRepository');
        expect(lockSalaryByMonth).toBeDefined();
        await createInstallmentSalaries(pool, { throughMonth: '2027-01' });
        for (const [month, label] of [['2026-12', '정시 시즌 고정급 (1/2)'], ['2027-01', '정시 시즌 고정급 (2/2)']]) {
            const salary = await salaryOf(YEONYO, month);
            expect(Number(salary.net_salary)).toBe(1500000);
            expect(details(salary).base_lines).toEqual([expect.objectContaining({ label, amount: 1500000 })]);
        }
        // 시즌 안 출근이 더 들어와도 횟수로 계산하지 않는다
        await attend(YEONYO, '2026-12-01', ['evening']);
        expect(Number((await salaryOf(YEONYO, '2026-12')).net_salary)).toBe(1500000);
    });

    test('오철민: 월급 1,200,000원·3.3% 그대로, 분할 달에만 +1,500,000원(세금 뗄지 고를 수 있다)', async () => {
        await november();
        expect((await post('/rules', season(CHEOLMIN))).status).toBe(201);
        const nov = await salaryOf(CHEOLMIN, '2026-11');
        expect([Number(nov.base_amount), Number(nov.tax_amount), Number(nov.net_salary)]).toEqual([1200000, 39600, 1160400]);
        await attend(CHEOLMIN, '2026-12-02', ['evening']);
        const dec = await salaryOf(CHEOLMIN, '2026-12');
        expect([Number(dec.base_amount), Number(dec.tax_amount), Number(dec.net_salary)]).toEqual([2700000, 89100, 2610900]);
        const { rules: [rule] } = (await request(app).get(`/rules?instructor_id=${CHEOLMIN}`)).body;
        expect((await request(app).put(`/rules/${rule.id}`).send(season(CHEOLMIN, { taxable: false }))).status).toBe(200);
        const untaxed = await salaryOf(CHEOLMIN, '2026-12');
        expect([Number(untaxed.tax_amount), Number(untaxed.net_salary)]).toEqual([39600, 2660400]);
        // 월급 강사에게 수업당 규칙은 막는다
        expect((await post('/rules', { instructor_id: CHEOLMIN, pay_type: 'daily', amount: 100000 })).status).toBe(400);
    });

    test('날짜 없이 금액만: 출근 계산은 그대로, 정한 달에 금액만 더한다. 어느 강사든 된다', async () => {
        await november();
        const response = await post('/rules', { instructor_id: YEONYO, pay_type: 'fixed_total', amount: 500000, memo: '보너스', installments: [{ pay_year_month: '2026-11', amount: 500000 }] });
        expect(response.status).toBe(201);
        expect(Number((await salaryOf(YEONYO, '2026-11')).net_salary)).toBe(560000 + 500000);
        expect((await post('/rules', { instructor_id: SEONGJUN, pay_type: 'fixed_total', amount: 100000, taxable: false, installments: [{ pay_year_month: '2026-11', amount: 100000 }] })).status).toBe(201);
        const seongjun = await salaryOf(SEONGJUN, '2026-11');
        expect(Number(seongjun.tax_amount)).toBe(242935);
        expect(Number(seongjun.net_salary)).toBe(Math.floor((2600000 - 242935) / 10) * 10);
    });

    test('수업당·하루·월급 규칙과 시간대 선택', async () => {
        await november();
        expect((await post('/rules', { instructor_id: YEONYO, pay_type: 'per_class', amount: 50000, start_date: '2026-11-23', end_date: '2026-11-25', time_slots: ['evening'] })).status).toBe(201);
        // 저녁 1회만 50,000원, 나머지 15회는 35,000원
        expect(Number((await salaryOf(YEONYO, '2026-11')).base_amount)).toBe(15 * 35000 + 50000);
        expect((await post('/rules', { instructor_id: YEONYO, pay_type: 'daily', amount: 100000, start_date: '2026-11-23', time_slots: ['morning', 'afternoon'] })).status).toBe(201);
        expect(Number((await salaryOf(YEONYO, '2026-11')).base_amount)).toBe(9 * 35000 + 50000 + 3 * 100000);
        // 같은 날짜·시간대에 겹치는 규칙은 막는다
        expect((await post('/rules', season(YEONYO))).body.error).toBe('RULE_OVERLAP');
        await q('DELETE FROM instructor_pay_rules');
        expect((await post('/rules', { instructor_id: YEONYO, pay_type: 'monthly', amount: 800000, start_date: '2026-11-21' })).status).toBe(201);
        expect(Number((await salaryOf(YEONYO, '2026-11')).base_amount)).toBe(9 * 35000 + 800000);
    });

    test('조정: 세금 대상 선택, 재계산·출근 뒤에도 남고, 지급 완료면 막힌다', async () => {
        await november();
        const salary = await salaryOf(CHEOLMIN, '2026-11');
        const added = await post(`/salaries/${salary.id}/adjustments`, { label: '보너스', amount: 100000, memo: '수고' });
        expect([added.status, added.body.tax_amount, added.body.net_salary]).toEqual([201, 42900, 1257100]);
        const minus = await post(`/salaries/${salary.id}/adjustments`, { label: '차감', amount: -30000, taxable: false });
        expect([minus.body.tax_amount, minus.body.net_salary]).toEqual([42900, 1227100]);
        expect((await post(`/salaries/${salary.id}/recalculate`)).body.salary.net_salary).toBe(1227100);
        await attend(CHEOLMIN, '2026-11-04', ['evening']);
        expect(Number((await salaryOf(CHEOLMIN, '2026-11')).net_salary)).toBe(1227100);
        const list = (await request(app).get('/salaries')).body.salaries.find(row => row.id === salary.id);
        expect([Number(list.adjustment_amount), Number(list.adjustment_count)]).toEqual([70000, 2]);
        const detail = (await request(app).get(`/salaries/${salary.id}`)).body;
        expect(detail.adjustments.map(item => [item.label, item.amount])).toEqual([['보너스', 100000], ['차감', -30000]]);
        const [first, second] = detail.adjustments;
        const edited = await request(app).put(`/salaries/${salary.id}/adjustments/${first.id}`).send({ label: '보너스', amount: 200000 });
        expect(edited.body.net_salary).toBe(1200000 + 200000 - 30000 - 46200);
        expect((await request(app).delete(`/salaries/${salary.id}/adjustments/${second.id}`)).body.adjustment_amount).toBe(200000);
        // 잘못된 값·다른 학원·0원 아래로는 막고 아무것도 남기지 않는다
        for (const body of [{ label: '', amount: 1 }, { label: 'x', amount: 0 }, { label: 'x', amount: 1.5 }, { label: 'x', amount: '1' }, { label: 'x', amount: -99999999 }]) {
            expect((await post(`/salaries/${salary.id}/adjustments`, body)).status).toBe(400);
        }
        expect((await post(`/salaries/${salary.id}/adjustments`, { label: 'x', amount: 1 }, 2)).status).toBe(404);
        expect(await q('SELECT id FROM salary_adjustments')).toHaveLength(1);

        expect((await post(`/salaries/${salary.id}/pay`, { payment_date: '2026-12-10' })).status).toBe(200);
        const paid = await salaryOf(CHEOLMIN, '2026-11');
        expect((await post(`/salaries/${salary.id}/adjustments`, { label: 'x', amount: 1000 })).body.error).toBe('SALARY_PAID');
        expect((await request(app).put(`/salaries/${salary.id}/adjustments/${first.id}`).send({ label: 'x', amount: 1 })).status).toBe(400);
        expect((await request(app).delete(`/salaries/${salary.id}/adjustments/${first.id}`)).status).toBe(400);
        expect((await request(app).put(`/salaries/${salary.id}`).send({ incentive_amount: 1000 })).status).toBe(400);
        expect((await request(app).delete(`/salaries/${salary.id}`)).status).toBe(400);
        expect((await post(`/salaries/${salary.id}/recalculate`)).status).toBe(400);
        expect((await post(`/salaries/${salary.id}/pay`, {})).status).toBe(400);
        await attend(CHEOLMIN, '2026-11-05', ['evening']);
        // 지급 완료 뒤 규칙을 넣어도 그 달은 그대로, 그 달 분할액은 막는다
        expect((await post('/rules', season(CHEOLMIN))).status).toBe(201);
        expect((await post('/rules', { instructor_id: CHEOLMIN, pay_type: 'fixed_total', amount: 1, installments: [{ pay_year_month: '2026-11', amount: 1 }] })).body.error).toBe('MONTH_PAID');
        expect(await salaryOf(CHEOLMIN, '2026-11')).toEqual(paid);
        expect(await q('SELECT amount FROM expenses')).toEqual([{ amount: paid.net_salary }]);
    });

    test('기본급 직접 입력·출근 없는 달 명세서 만들기', async () => {
        const opened = await post('/salaries/open', { instructor_id: YEONYO, year_month: '2026-12' });
        expect(opened.status).toBe(201);
        const id = opened.body.salary.id;
        expect((await post('/salaries/open', { instructor_id: YEONYO, year_month: '2026-12' })).body.salary.id).toBe(id);
        expect((await post('/salaries/open', { instructor_id: OTHER, year_month: '2026-12' })).status).toBe(404);
        expect((await request(app).put(`/salaries/${id}`).send({ base_override: 777777 })).status).toBe(200);
        expect(Number((await salaryOf(YEONYO, '2026-12')).base_amount)).toBe(777777);
        await attend(YEONYO, '2026-12-01', ['evening']);
        expect(Number((await salaryOf(YEONYO, '2026-12')).base_amount)).toBe(777777);
        expect((await request(app).put(`/salaries/${id}`).send({ base_override: null })).status).toBe(200);
        expect(Number((await salaryOf(YEONYO, '2026-12')).base_amount)).toBe(35000);
        expect((await request(app).put(`/salaries/${id}`).send({ base_override: -1 })).status).toBe(400);
    });

    test('규칙 저장 검사: 분할 합계 경고, 날짜·금액·시간대, 다른 학원, 삭제', async () => {
        await november();
        const mismatch = season(YEONYO, { installments: [{ pay_year_month: '2026-12', amount: 1000000 }] });
        expect((await post('/rules', mismatch)).body).toMatchObject({ error: 'INSTALLMENT_MISMATCH', installment_total: 1000000 });
        for (const bad of [{ amount: 0 }, { amount: 1.5 }, { start_date: '2026-13-01' }, { start_date: '2027-02-01' }, { time_slots: [] }, { pay_type: 'x' },
            { installments: [{ pay_year_month: '2026-12', amount: 1500000 }, { pay_year_month: '2026-12', amount: 1500000 }] }]) {
            expect((await post('/rules', season(YEONYO, bad))).status).toBe(400);
        }
        expect((await post('/rules', season(OTHER))).status).toBe(404);
        expect(await q('SELECT id FROM instructor_pay_rules')).toHaveLength(0);
        const created = await post('/rules', { ...mismatch, confirm_mismatch: true });
        expect(created.status).toBe(201);
        expect((await request(app).delete(`/rules/${created.body.id}`).set('x-academy', '2')).status).toBe(404);
        expect((await request(app).delete(`/rules/${created.body.id}`)).status).toBe(200);
        // 규칙을 지우면 미지급 급여는 원래 계산으로 돌아온다
        expect(Number((await salaryOf(YEONYO, '2026-11')).net_salary)).toBe(560000);
    });

    test('시즌 연동: 여러 강사에게 한 번에, 하나라도 안 되면 모두 취소, 시즌 기간 변경 반영', async () => {
        const body = { instructor_ids: [YEONYO, CHEOLMIN], amount: 3000000, installments: season(YEONYO).installments };
        expect((await post('/rules/season/21', { ...body, instructor_ids: [YEONYO, OTHER] })).status).toBe(404);
        expect(await q('SELECT id FROM instructor_pay_rules')).toHaveLength(0);
        expect((await post('/rules/season/21', body)).status).toBe(201);
        let { rules } = (await request(app).get('/rules?season_id=21')).body;
        expect(rules.map(rule => [rule.instructor_id, rule.start_date, rule.end_date, rule.time_slots, rule.season_name])).toEqual([
            [CHEOLMIN, '2026-11-23', '2027-01-29', ALL, '2027 정시집중'], [YEONYO, '2026-11-23', '2027-01-29', ALL, '2027 정시집중']]);
        await q("UPDATE seasons SET season_end_date = '2027-01-31' WHERE id = 21");
        expect((await post('/rules/season/21/sync', { rule_ids: [rules[0].id] })).status).toBe(200);
        ({ rules } = (await request(app).get('/rules?season_id=21')).body);
        expect(rules.map(rule => rule.end_date)).toEqual(['2027-01-31', '2027-01-29']);
        expect(rules[0].installments).toEqual(body.installments);
        expect((await post('/rules/season/21/sync', { rule_ids: [rules[0].id] }, 2)).status).toBe(404);
        // 끝나는 날을 따로 정할 수 있다
        await q('DELETE FROM instructor_pay_rules');
        expect((await post('/rules/season/21', { ...body, end_date: '2027-02-05' })).status).toBe(201);
        expect((await one('SELECT end_date FROM instructor_pay_rules LIMIT 1')).end_date).toBe('2027-02-05');
    });

    test('규칙·조정이 없는 강사: 출근 체크·재계산 금액이 바꾸기 전 계산과 1원까지 같다', async () => {
        let seed = 7;
        const random = max => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % max; };
        const pick = list => list[random(list.length)];
        const wrong = [];
        for (let i = 0; i < 160; i++) {
            const instructor = { id: 1000 + i, academy_id: 1, name: 'x', salary_type: ['hourly', 'per_class', 'monthly', 'mixed'][i % 4], tax_type: pick(['3.3%', 'insurance', 'none']),
                base_salary: pick([0, 1200000, 2500000, 2333333]), hourly_rate: pick([0, 10030, 35000, 33333]), morning_class_rate: pick([0, 41111]), afternoon_class_rate: pick([0, 45000]), evening_class_rate: pick([0, 50500]) };
            await q('INSERT INTO instructors SET ?', instructor);
            const attendances = [];
            for (let day = 1; day <= 1 + random(12); day++) {
                const timed = random(3) > 0;
                attendances.push({ instructor_id: instructor.id, work_date: `2026-10-${String(day).padStart(2, '0')}`, time_slot: pick(ALL), attendance_status: pick(['present', 'late', 'absent', 'present']),
                    check_in_time: timed ? '09:10:00' : null, check_out_time: timed ? pick(['12:00:00', '13:35:00']) : null });
            }
            for (const row of attendances) await q('INSERT INTO instructor_attendance SET ?', row);
            const counted = attendances.filter(row => row.attendance_status !== 'absent');
            await updateSalaryFromAttendance(pool, instructor.id, 1, '2026-10-01', 'present');
            for (const mode of ['auto', 'recalc']) {
                if (mode === 'recalc') await post(`/salaries/${(await salaryOf(instructor.id, '2026-10')).id}/recalculate`);
                const row = await salaryOf(instructor.id, '2026-10');
                const want = legacy(instructor, counted, '2026-10', mode);
                const got = [row.base_amount, row.tax_amount, row.net_salary].map(Number);
                const expected = [want.base, want.tax, want.net].map(value => Math.round(value * 100) / 100);
                if (got.some((value, index) => value !== expected[index])) wrong.push({ i, mode, type: instructor.salary_type, tax: instructor.tax_type, got, expected });
            }
        }
        expect(wrong).toEqual([]);
    }, 120000);
});
