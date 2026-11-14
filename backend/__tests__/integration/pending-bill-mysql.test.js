/**
 * 미납 청구 갱신(네 경로)과 일괄·학생별 청구를 일회용 MySQL 8 에서 실제로 돌린다 — DECIMAL 칸·인자 섞임에서 원 단위 결과 확인.
 * 표는 max-engine-schema.json(운영 칸 형식)으로 만들고, 지점·반·시즌 칸은 저장소 마이그레이션을 그대로 적용한다.
 * RUN_MAX_ENGINE_MYSQL=1 TEST_MYSQL_PORT=<10000 이상 전용 포트> 일 때만 돈다. 운영 자격 증명·실제 학생 없음.
 */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__pendingBillMysql);
jest.mock('../../middleware/auth', () => ({
    verifyToken: (req, res, next) => { req.user = { academyId: 1, userId: 1, role: 'owner' }; next(); },
    checkPermission: () => (req, res, next) => next(),
    requireRole: () => (req, res, next) => next(),
}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../services/seasonGraduationService', () => ({ graduateDueSeasonStudents: jest.fn().mockResolvedValue(0) }));
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const express = require('express');
const request = require('supertest');
const schema = require('./max-engine-schema.json');
const { monthlyBillAmounts, floorRatio } = require('../../utils/monthlyBillAmounts');

const database = 'pending_bill_mysql_test';
const TABLES = ['academies', 'academy_settings', 'students', 'student_payments', 'rest_credits', 'classes', 'seasons', 'student_seasons',
    'instructors', 'consultations', 'max_engine_payment_settlements', 'revenues'];
const MIGRATIONS = ['20261001_add_season_aftercare.mysql', '20261112_add_branches_and_student_class.mysql', '20261113_add_student_payment_branch.mysql',
    '20261114_add_consultation_branch.mysql', '20261116_add_class_instructor.mysql', '20261118_add_class_tuition_by_weekly.mysql',
    '20261118_add_season_branch.mysql'];
const koreaMonth = offset => {
    const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
};
const THIS_MONTH = koreaMonth(0), NEXT_MONTH = koreaMonth(1), LAST_MONTH = koreaMonth(-1);

run('미납 청구 갱신·월 청구 금액 — 실제 MySQL 8', () => {
    let admin, pool;
    beforeAll(async () => {
        const port = Number(process.env.TEST_MYSQL_PORT);
        if (!Number.isSafeInteger(port) || port < 10000) throw new Error('Dedicated TEST_MYSQL_PORT >=10000 required');
        const options = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true, timezone: '+09:00', multipleStatements: true };
        admin = await mysql.createConnection(options);
        await admin.query(`DROP DATABASE IF EXISTS ${database}`);
        await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);
        for (const table of TABLES) {
            const columns = schema[`paca.${table}`];
            const defs = columns.map(([col, type, nullable]) => `\`${col}\` ${type} ${col === 'id' ? 'NOT NULL AUTO_INCREMENT PRIMARY KEY'
                : col === 'is_prorated' ? 'NOT NULL DEFAULT 0' : nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
            await admin.query(`CREATE TABLE ${database}.\`${table}\` (${defs.join(',')}) ENGINE=InnoDB`);
        }
        await admin.query(`USE ${database}`);
        for (const file of MIGRATIONS) {
            const sql = fs.readFileSync(path.join(__dirname, '../../migrations', file), 'utf8');
            for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await admin.query(statement);
        }
        // 운영과 같은 유일 키(학생·월·종류) — 같은 달 월 청구가 두 개 생기지 않는다
        await admin.query('ALTER TABLE student_payments ADD UNIQUE KEY uq_student_month_type (student_id, `year_month`, payment_type)');
        pool = mysql.createPool({ ...options, database, multipleStatements: false });
        pool.on('connection', connection => connection.query("SET time_zone = '+09:00'"));
        global.__pendingBillMysql = pool;
    });
    afterAll(async () => {
        await admin?.query(`DROP DATABASE IF EXISTS ${database}`);
        await pool?.end(); await admin?.end();
    });

    async function seed({ tuition, rate, classId = 9, classTable = 450000, academyWeekly2 = 450000, credit = 0, bills: withBills = true }) {
        for (const table of ['student_payments', 'rest_credits', 'students', 'classes', 'branches', 'academy_settings', 'academies', 'seasons', 'student_seasons']) {
            await pool.query(`DELETE FROM ${table}`);
        }
        await pool.query("INSERT INTO academies (id, owner_user_id, name, tuition_due_day) VALUES (1, 1, '합성 학원', 5)");
        await pool.query('INSERT INTO academy_settings (id, academy_id, tuition_due_day, settings) VALUES (1, 1, 5, ?)',
            [JSON.stringify({ exam_tuition: { weekly_2: academyWeekly2, weekly_3: 300000 } })]);
        await pool.query("INSERT INTO branches (id, academy_id, name) VALUES (1, 1, '수성')");
        await pool.query(`INSERT INTO classes (id, academy_id, class_name, branch_id, tuition_by_weekly) VALUES
            (8, 1, '반 표 있는 반', 1, ?), (9, 1, '기본표 반', 1, NULL)`, [JSON.stringify({ weekly_3: classTable })]);
        await pool.query(`INSERT INTO students (id, academy_id, name, student_type, grade, admission_type, class_days, weekly_count,
            monthly_tuition, discount_rate, status, is_trial, time_slot, branch_id, class_id, enrollment_date, payment_due_day)
            VALUES (1, 1, '합성', 'exam', '고3', 'regular', '[1,3,5]', 3, ?, ?, 'active', 0, 'evening', 1, ?, '2026-01-02', 5)`,
        [tuition, rate, classId]);
        const bill = (id, month, status, description, additional, carryover, final) => pool.query(`INSERT INTO student_payments
            (id, student_id, academy_id, \`year_month\`, payment_type, base_amount, discount_amount, additional_amount, carryover_amount,
             final_amount, paid_amount, is_prorated, due_date, payment_status, description)
            VALUES (?, 1, 1, ?, 'monthly', 300000, 0, ?, ?, ?, 0, 0, ?, ?, ?)`, [id, month, additional, carryover, final, `${month}-05`, status, description]);
        if (credit) {
            await pool.query(`INSERT INTO rest_credits (id, student_id, academy_id, rest_start_date, rest_end_date, rest_days, credit_amount,
                remaining_amount, credit_type, status, created_at) VALUES (1, 1, 1, '2026-01-01', '2026-01-10', 10, ?, ?, 'carryover', 'pending', NOW())`,
            [credit, credit]);
        }
        if (!withBills) return;
        await bill(1, THIS_MONTH, 'pending', '이번 달 학원비', '5000.50', 12300, '293000.00');
        await bill(2, LAST_MONTH, 'pending', '지난 달 학원비', '0.00', 0, '300000.00');
        await bill(3, NEXT_MONTH, 'pending', `${Number(NEXT_MONTH.slice(5))}월 학원비 (비시즌 종강 일할)`, '0.00', 0, '120000.00');
    }
    const bills = async () => (await pool.query('SELECT id, base_amount, discount_amount, final_amount FROM student_payments ORDER BY id'))[0]
        .map(row => [row.id, Number(row.base_amount), Number(row.discount_amount), Number(row.final_amount)]);
    const expectBills = async (tuition, rate) => {
        const want = monthlyBillAmounts(tuition, rate, '5000.50', 12300);
        expect(await bills()).toEqual([
            [1, Number(tuition), want.discount, want.final], // 이번 달 미납: 월 자동 청구와 같은 식
            [2, 300000, 0, 300000], // 지난 달: 그대로
            [3, 300000, 0, 120000], // 비시즌 종강 일할: 그대로
        ]);
    };
    const app = () => {
        const a = express(); a.use(express.json());
        const students = express.Router(); require('../../routes/students/classDays')(students); require('../../routes/students/credits')(students);
        a.use('/paca/students', students);
        a.use('/paca/branches', require('../../routes/branches'));
        const payments = express.Router();
        require('../../routes/payments/bulk')(payments); require('../../routes/payments/bulk/monthlyForStudent')(payments);
        require('../../routes/payments/crud')(payments); require('../../routes/payments/early-pay')(payments);
        require('../../routes/payments/prepaid')(payments); require('../../routes/payments/pay')(payments);
        a.use('/paca/payments', payments);
        const seasons = express.Router(); require('../../routes/seasons/enrollments')(seasons); a.use('/paca/seasons', seasons);
        return a;
    };
    const confirm = changes => changes.map(({ student_id, current_tuition, new_tuition }) => ({ student_id, current_tuition, new_tuition }));

    test('학생 수정: 전 단위 학원비 333,333.33원·할인 12.5%(DECIMAL 저장값)로 이번 달 미납만 다시 계산, 저장값이 그대로면 안 쓴다', async () => {
        await seed({ tuition: '333333.33', rate: '12.50' });
        const { updatePendingPayments } = require('../../routes/students/crud/update/paymentEffects');
        const [[student]] = await pool.query('SELECT * FROM students WHERE id = 1');
        const conn = await pool.getConnection();
        try {
            await updatePendingPayments({ pool: conn, studentId: 1, academyId: 1, monthlyTuition: 333333.33, discountRate: 12.5,
                oldStatus: 'active', oldStudent: { ...student, monthly_tuition: '300000.00' }, updatedStudent: student });
            await expectBills('333333.33', '12.50');
            // 같은 값으로 다시 저장(전화번호만 고침): 손으로 고친 금액도 그대로
            await pool.query("UPDATE student_payments SET discount_amount = 40000, final_amount = 286000 WHERE id = 1");
            await updatePendingPayments({ pool: conn, studentId: 1, academyId: 1, monthlyTuition: 333333.33, discountRate: 12.5,
                oldStatus: 'active', oldStudent: student, updatedStudent: student });
            expect((await bills())[0]).toEqual([1, 333333.33, 40000, 286000]);
        } finally {
            conn.release();
        }
    });

    test('수업일 변경: 학원 표 주2회 333,333원 → 이번 달 미납만, 비시즌 종강 일할은 그대로', async () => {
        await seed({ tuition: 300000, rate: '12.50', academyWeekly2: 333333 });
        const res = await request(app()).put('/paca/students/1/class-days').send({ class_days: [1, 3] });
        expect(res.status).toBe(200);
        await expectBills(333333, '12.50');
    });

    test('반 학원비 적용: 반 표 주3회 333,333원', async () => {
        await seed({ tuition: 300000, rate: '12.50', classId: 8, classTable: 333333 });
        const preview = (await request(app()).get('/paca/branches/classes/8/tuition-preview')).body.students;
        expect(preview[0].pending_bills).toEqual([{ id: 1, year_month: THIS_MONTH, current_amount: 293000,
            new_amount: monthlyBillAmounts(333333, 12.5, '5000.50', 12300).final }]);
        expect((await request(app()).post('/paca/branches/classes/8/apply-tuition').send({ changes: confirm(preview) })).status).toBe(200);
        await expectBills(333333, '12.50');
    });

    test('반 이동: 반 표 주3회 333,333원인 반으로 옮기며 학원비도 바꿈', async () => {
        await seed({ tuition: 300000, rate: '12.50', classTable: 333333 });
        const { changes } = (await request(app()).post('/paca/branches/students/tuition-preview').send({ student_ids: [1], class_id: 8 })).body;
        const moved = await request(app()).put('/paca/branches/students').send({ student_ids: [1], class_id: 8, tuition_changes: confirm(changes) });
        expect(moved.status).toBe(200);
        await expectBills(333333, '12.50');
    });

    test('일괄 청구·학생별 청구: 333,333.33원·할인 12.5%·크레딧 12,300원 → 같은 금액, 크레딧은 한 번만', async () => {
        const month = koreaMonth(2), [year, mon] = month.split('-').map(Number);
        await seed({ tuition: '333333.33', rate: '12.50', credit: 12300 });
        const want = monthlyBillAmounts('333333.33', '12.50', 0, 12300);
        const bulk = await request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon });
        expect(bulk.status).toBe(200);
        const [[made]] = await pool.query('SELECT base_amount, discount_amount, carryover_amount, final_amount FROM student_payments WHERE `year_month` = ?', [month]);
        expect([Number(made.base_amount), Number(made.discount_amount), made.carryover_amount, Number(made.final_amount)])
            .toEqual([333333.33, want.discount, 12300, want.final]);
        expect((await pool.query('SELECT remaining_amount, status FROM rest_credits'))[0][0]).toMatchObject({ remaining_amount: 0, status: 'applied' });

        // 학생별 청구: 같은 학생·같은 크레딧으로 다음 달
        await seed({ tuition: '333333.33', rate: '12.50', credit: 12300 });
        const single = await request(app()).post('/paca/payments/generate-monthly-for-student').send({ student_id: 1, year, month: mon });
        expect(single.status).toBe(201);
        expect([Number(single.body.payment.base_amount), Number(single.body.payment.discount_amount), single.body.payment.carryover_amount,
            Number(single.body.payment.final_amount)]).toEqual([333333.33, want.discount, 12300, want.final]);

        // 이미 낸 청구가 있는 달은 크레딧을 건드리지 않고 건너뛴다
        await seed({ tuition: '333333.33', rate: '12.50', credit: 12300 });
        await pool.query(`INSERT INTO student_payments (student_id, academy_id, \`year_month\`, payment_type, base_amount, final_amount, paid_amount,
            is_prorated, due_date, payment_status) VALUES (1, 1, ?, 'monthly', 300000, 300000, 300000, 0, ?, 'paid')`, [month, `${month}-05`]);
        const skipped = await request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon });
        expect(skipped.body).toMatchObject({ skipped: 1, withCarryover: 0 });
        expect((await pool.query('SELECT remaining_amount, status FROM rest_credits'))[0][0]).toMatchObject({ remaining_amount: 12300, status: 'pending' });
    });

    test('[DOUBLE 섞임] 미납 갱신 SQL 이 전 단위 학원비·소수 할인율·추가 금액 조합에서 JS 계산과 원 단위까지 같다(execute·query 둘 다)', async () => {
        const { pendingMonthlyTuitionUpdate } = require('../../repositories/pendingMonthlyTuitionRepository');
        await seed({ tuition: 300000, rate: 0, bills: false });
        const cases = [];
        for (let cents = 1; cents < 100; cents += 3) {
            for (const rate of ['0', '12.50', '5.00', '33.33']) {
                for (const base of [333333, 1000000, 450999]) {
                    const tuition = (base + cents / 100).toFixed(2);
                    const discount = monthlyBillAmounts(tuition, rate).discount;
                    // 학원비 − 할인액 + 추가 금액이 정확히 천원 배수가 되는 추가 금액(경계: DOUBLE 이면 999.99… 로 내려간다)
                    const centsTotal = Math.round(Number(tuition) * 100) - discount * 100;
                    const additional = ((Math.ceil(centsTotal / 100000) * 100000 - centsTotal) / 100).toFixed(2);
                    cases.push([tuition, rate, additional, 0], [tuition, rate, additional, 700]);
                }
            }
        }
        const wrong = [];
        for (const [tuition, rate, additional, carryover] of cases) {
            for (const via of ['execute', 'query']) {
                await pool.query('DELETE FROM student_payments');
                await pool.query(`INSERT INTO student_payments (student_id, academy_id, \`year_month\`, payment_type, base_amount, discount_amount,
                    additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status, description)
                    VALUES (1, 1, ?, 'monthly', 0, 0, ?, ?, 0, 0, 0, ?, 'pending', '월 학원비')`, [THIS_MONTH, additional, carryover, `${THIS_MONTH}-05`]);
                // 실제 호출처처럼 저장값 문자열을 넘긴다
                await pool[via](...pendingMonthlyTuitionUpdate({ studentId: 1, academyId: 1, tuition, discountRate: rate }));
                const [[row]] = await pool.query('SELECT discount_amount, final_amount FROM student_payments');
                const want = monthlyBillAmounts(tuition, rate, additional, carryover);
                if (Number(row.final_amount) !== want.final || Number(row.discount_amount) !== want.discount) {
                    wrong.push({ via, tuition, rate, additional, carryover, db: row.final_amount, js: want.final });
                }
            }
        }
        expect(cases.length).toBeGreaterThan(700);
        expect(wrong).toEqual([]);
    }, 120000);

    test('수업일 변경 예약: 1일 00:01 월 자동 청구가 예전 학원비로 먼저 만들고, 00:05 예약 적용 뒤 그 청구가 새 금액', async () => {
        await seed({ tuition: 300000, rate: '12.50', academyWeekly2: 333333, bills: false });
        await pool.query('UPDATE students SET class_days_next = ?, class_days_effective_from = ? WHERE id = 1',
            ['[1,3]', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())]);
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const { generateMonthlyPayments } = require('../../scheduler/paymentScheduler');
        await generateMonthlyPayments(); // 00:01 월 자동 청구
        log.mockRestore();
        const monthBill = async () => (await pool.query(
            'SELECT base_amount, discount_amount, final_amount FROM student_payments WHERE `year_month` = ? AND payment_type = \'monthly\'', [THIS_MONTH]))[0]
            .map(row => [Number(row.base_amount), Number(row.discount_amount), Number(row.final_amount)]);
        expect(await monthBill()).toEqual([[300000, 37000, 263000]]);
        const { applyScheduledClassDaysChanges } = require('../../scheduler/classDaysScheduler');
        const result = await applyScheduledClassDaysChanges(); // 00:05 예약 적용
        expect(result.students[0].newTuition).toBe(333333);
        const want = monthlyBillAmounts(333333, '12.50');
        expect(await monthBill()).toEqual([[333333, want.discount, want.final]]);
    });

    test('청구 수정 화면: 크레딧 166,500원·학원비 450,000원 → 283,000원, 월 청구로 만든 금액과 같다', async () => {
        const month = koreaMonth(2), [year, mon] = month.split('-').map(Number);
        await seed({ tuition: 450000, rate: 0, credit: 166500, bills: false });
        expect((await request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon })).status).toBe(200);
        const [[made]] = await pool.query('SELECT id, carryover_amount, final_amount FROM student_payments WHERE `year_month` = ?', [month]);
        expect([made.carryover_amount, Number(made.final_amount)]).toEqual([166500, 283000]);
        // 같은 금액으로 저장만 다시 해도(예전 식 450,000 − 166,500 = 283,500) 월 청구 금액 그대로
        expect((await request(app()).put(`/paca/payments/${made.id}`).send({ base_amount: 450000 })).status).toBe(200);
        const [[saved]] = await pool.query('SELECT final_amount FROM student_payments WHERE id = ?', [made.id]);
        expect(Number(saved.final_amount)).toBe(283000);
        // 추가 금액 10,000원 넣으면 월 청구 공통 식 그대로
        expect((await request(app()).put(`/paca/payments/${made.id}`).send({ additional_amount: 10000 })).status).toBe(200);
        const [[added]] = await pool.query('SELECT final_amount FROM student_payments WHERE id = ?', [made.id]);
        expect(Number(added.final_amount)).toBe(monthlyBillAmounts(450000, 0, 10000, 166500).final);
    });

    test('크레딧 수동 적용: 166,500원 → 283,000원(월 청구로 만든 금액과 같음), 잔액 정확, 동시에 두 번 눌러도 한 번만', async () => {
        const month = koreaMonth(2), [year, mon] = month.split('-').map(Number);
        const apply = () => request(app()).post('/paca/students/1/credits/1/apply').send({ year_month: month });
        const pendingBill = () => pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type,
            base_amount, discount_amount, additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status)
            VALUES (1, 1, 1, ?, 'monthly', 450000, 0, 0, 0, 450000, 0, 0, ?, 'pending')`, [month, `${month}-05`]);
        const state = async () => {
            const [[bill]] = await pool.query('SELECT carryover_amount, rest_credit_id, final_amount FROM student_payments WHERE id = 1');
            const [[credit]] = await pool.query('SELECT remaining_amount, status, applied_to_payment_id FROM rest_credits WHERE id = 1');
            return [bill.carryover_amount, bill.rest_credit_id, Number(bill.final_amount), credit.remaining_amount, credit.status, credit.applied_to_payment_id];
        };

        // 같은 학생·같은 크레딧을 월 청구로 만들면
        await seed({ tuition: 450000, rate: 0, credit: 166500, bills: false });
        expect((await request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon })).status).toBe(200);
        const [[monthly]] = await pool.query('SELECT final_amount FROM student_payments WHERE `year_month` = ?', [month]);

        // 수동 적용
        await seed({ tuition: 450000, rate: 0, credit: 166500, bills: false });
        await pendingBill();
        const res = await apply();
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ applied_amount: 166500, new_final_amount: 283000, credit_remaining: 0 });
        expect(await state()).toEqual([166500, 1, 283000, 0, 'applied', 1]);
        expect(Number(monthly.final_amount)).toBe(283000);

        // 동시에 두 번: 한 번만 적용
        await seed({ tuition: 450000, rate: 0, credit: 166500, bills: false });
        await pendingBill();
        const both = await Promise.all([apply(), apply()]);
        expect(both.map(r => r.status).sort()).toEqual([200, 400]);
        expect(await state()).toEqual([166500, 1, 283000, 0, 'applied', 1]);

        // 크레딧이 청구보다 크면 청구만큼만 빼고 잔액을 남긴다 — 동시에 두 번이어도 더 빠지지 않는다
        await seed({ tuition: 450000, rate: 0, credit: 500000, bills: false });
        await pendingBill();
        const partial = await Promise.all([apply(), apply()]);
        expect(partial.map(r => r.status).sort()).toEqual([200, 400]);
        expect(await state()).toEqual([450000, 1, 0, 50000, 'partial', 1]);
    });

    test('휴원 정산·복귀로 최종 금액만 줄인 청구: 크레딧 적용·청구 수정 저장·AI 연결 청구 수정이 줄인 금액 기준', async () => {
        const month = koreaMonth(2);
        const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
        const transaction = async work => {
            const conn = await pool.getConnection();
            try { await conn.beginTransaction(); const out = await work(conn); await conn.commit(); return out; }
            catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
        };
        const bill = async () => {
            const [[row]] = await pool.query('SELECT base_amount, additional_amount, carryover_amount, final_amount FROM student_payments WHERE id = 1');
            return [Number(row.base_amount), Number(row.additional_amount), row.carryover_amount, Number(row.final_amount)];
        };
        const manualCredit = amount => pool.query(`INSERT INTO rest_credits (id, student_id, academy_id, rest_start_date, rest_end_date, rest_days,
            credit_amount, remaining_amount, credit_type, status, created_at) VALUES (5, 1, 1, '2026-01-01', '2026-01-02', 1, ?, ?, 'manual', 'pending', NOW())`, [amount, amount]);
        const { pause } = require('../../services/studentLifecycleBillingService');
        const { processResumePayment } = require('../../services/resumePaymentService');
        const engine = require('../../services/maxEngineFullPayments');

        // (1) 휴원 정산: 16일 휴원 → 최종 = 450,000 × 15/일수 (학원비 칸은 그대로)
        const reseedPaused = async () => {
            await seed({ tuition: 450000, rate: 0, bills: false });
            await pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type, base_amount, discount_amount,
                additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status)
                VALUES (1, 1, 1, ?, 'monthly', 450000, 0, 0, 0, 450000, 0, 0, ?, 'pending')`, [month, `${month}-05`]);
            await transaction(conn => pause(conn, { academyId: 1, studentId: 1, userId: 1, date: `${month}-16`, creditType: 'none' }));
        };
        const paused = floorRatio(450000, 15, days);
        await reseedPaused();
        expect(await bill()).toEqual([450000, 0, 0, paused]);

        // 크레딧 30,000원 수동 적용 → 줄인 금액 − 30,000 (예전: 450,000 − 30,000 = 420,000)
        await manualCredit(30000);
        const applied = await request(app()).post('/paca/students/1/credits/5/apply').send({ year_month: month });
        expect(applied.body).toMatchObject({ applied_amount: 30000, new_final_amount: paused - 30000, credit_remaining: 0 });
        expect(await bill()).toEqual([450000, 0, 30000, paused - 30000]);
        // 청구 수정 화면 저장(화면은 학원비를 같이 보낸다): 그대로, 추가 10,000원이면 그만큼만 (예전: 정액 420,000원으로)
        expect((await request(app()).put('/paca/payments/1').send({ base_amount: 450000, discount_amount: 0, additional_amount: 0, notes: '메모' })).status).toBe(200);
        expect(await bill()).toEqual([450000, 0, 30000, paused - 30000]);
        expect((await request(app()).put('/paca/payments/1').send({ base_amount: 450000, discount_amount: 0, additional_amount: 10000 })).status).toBe(200);
        expect(await bill()).toEqual([450000, 10000, 30000, paused - 20000]);
        // AI 연결 청구 수정: 추가 금액을 0원으로 되돌리면 다시 줄인 금액 − 크레딧
        await transaction(async conn => {
            const [[before]] = await conn.query('SELECT * FROM student_payments WHERE id = 1 FOR UPDATE');
            await engine.update(conn, 1, { additional_amount: '0', notes: '추가 취소' }, { ...before, student_status: 'paused' });
        });
        expect(await bill()).toEqual([450000, 0, 30000, paused - 30000]);

        // (2) 휴원 복귀: 21일 복귀 → 최종 = 450,000 × (15 + 일수 − 20)/일수, 학원비 칸 그대로 → 크레딧 적용은 그 금액 기준
        await reseedPaused();
        await pool.query("UPDATE students SET status = 'paused', rest_start_date = ? WHERE id = 1", [`${month}-16`]);
        const [[student]] = await pool.query('SELECT * FROM students WHERE id = 1');
        await transaction(connection => processResumePayment({ connection, student: { ...student, rest_start_date: `${month}-16` },
            resumeDate: `${month}-21`, classDays: [1, 3, 5], creditRecalculation: null, recordedBy: 1 }));
        const resumed = floorRatio(450000, 15 + days - 20, days);
        expect(await bill()).toEqual([450000, 0, 0, resumed]);
        await manualCredit(30000);
        const afterResume = await request(app()).post('/paca/students/1/credits/5/apply').send({ year_month: month });
        expect(afterResume.body).toMatchObject({ applied_amount: 30000, new_final_amount: resumed - 30000 });
        expect(await bill()).toEqual([450000, 0, 30000, resumed - 30000]);
    });

    test('미리 납부·선납: 기존 미납 청구의 추가 금액·크레딧을 지키고 공통 식, 휴원으로 줄인 청구는 줄인 금액 기준', async () => {
        const [m1, m2] = [koreaMonth(2), koreaMonth(3)];
        const pendingBill = (month, final, carryover = 166500, additional = 10000) => pool.query(`INSERT INTO student_payments (student_id, academy_id,
            \`year_month\`, payment_type, base_amount, discount_amount, additional_amount, carryover_amount, final_amount, paid_amount, is_prorated,
            due_date, payment_status) VALUES (1, 1, ?, 'monthly', 450000, 0, ?, ?, ?, 0, 0, ?, 'pending')`, [month, additional, carryover, final, `${month}-05`]);
        const monthBill = async month => {
            const [[row]] = await pool.query('SELECT discount_amount, additional_amount, carryover_amount, final_amount, paid_amount, payment_status FROM student_payments WHERE `year_month` = ?', [month]);
            return [Number(row.discount_amount), Number(row.additional_amount), row.carryover_amount, Number(row.final_amount), Number(row.paid_amount), row.payment_status];
        };

        // 미리 납부: 추가 10,000원·크레딧 166,500원 미납 청구 → 293,000원 (예전 450,000원)
        await seed({ tuition: 450000, rate: 0, bills: false });
        await pendingBill(m1, monthlyBillAmounts(450000, 0, 10000, 166500).final);
        const early = await request(app()).post('/paca/payments/early-pay').send({ student_id: 1, year_month: m1, payment_method: 'cash' });
        expect(early.body.final_amount).toBe(293000);
        expect(await monthBill(m1)).toEqual([0, 10000, 166500, 293000, 293000, 'paid']);

        // 미리 납부: 휴원으로 225,000원으로 줄인 청구(크레딧 없음) → 225,000원 그대로 (예전 450,000원)
        await seed({ tuition: 450000, rate: 0, bills: false });
        await pendingBill(m1, 225000, 0, 0);
        expect((await request(app()).post('/paca/payments/early-pay').send({ student_id: 1, year_month: m1, payment_method: 'cash' })).body.final_amount).toBe(225000);

        // 선납 2개월 5%: 선납 할인 22,000원(450,000 × 5% 천원 절삭, 그대로)
        //   m1 기존 미납(추가 10,000·크레딧 166,500) → 450,000 − 22,000 + 10,000 − 166,500 = 271,500 → 271,000 (예전 428,000)
        //   m2 새 청구 → 428,000
        await seed({ tuition: 450000, rate: 0, bills: false });
        await pendingBill(m1, 293000);
        const body = { student_id: 1, months: [m1, m2], prepaid_discount_rate: 5, payment_method: 'cash' };
        const preview = await request(app()).post('/paca/payments/prepaid-preview').send(body);
        expect(preview.body.months.map(m => m.final_amount)).toEqual([271000, 428000]);
        const paid = await request(app()).post('/paca/payments/prepaid-pay').send(body);
        expect(paid.body).toMatchObject({ total_amount: 699000, total_discount: 44000 });
        expect(await monthBill(m1)).toEqual([22000, 10000, 166500, 271000, 271000, 'paid']);
        expect(await monthBill(m2)).toEqual([22000, 0, null, 428000, 428000, 'paid']); // 새 선납 청구는 크레딧 칸을 쓰지 않는다(예전과 같음)
    });

    test('유일 키가 없는 표에서도 학생 잠금으로: 학생별·일괄·자동 청구·미리 납부·선납·청구 직접 만들기를 동시에 두 번 → 청구 하나·크레딧 한 번, 교착 없음', async () => {
        const month = koreaMonth(2), [year, mon] = month.split('-').map(Number);
        const monthBills = async () => (await pool.query('SELECT carryover_amount, final_amount, payment_status FROM student_payments WHERE `year_month` = ?', [month]))[0];
        const creditLeft = async () => (await pool.query('SELECT remaining_amount FROM rest_credits WHERE id = 1'))[0][0].remaining_amount;
        await admin.query('ALTER TABLE student_payments DROP INDEX uq_student_month_type');
        try {
            // 학생별 청구 동시 두 번
            await seed({ tuition: 300000, rate: 0, credit: 12300, bills: false });
            const single = await Promise.all([1, 2].map(() =>
                request(app()).post('/paca/payments/generate-monthly-for-student').send({ student_id: 1, year, month: mon })));
            expect(single.map(res => res.status).sort()).toEqual([201, 400]);
            expect((await monthBills()).map(row => [row.carryover_amount, Number(row.final_amount)])).toEqual([[12300, 287000]]);
            expect(await creditLeft()).toBe(0);

            // 일괄 청구 동시 두 번: 둘 다 200(교착 없음), 청구 하나, 크레딧 한 번
            await seed({ tuition: 300000, rate: 0, credit: 12300, bills: false });
            const bulk = await Promise.all([1, 2].map(() => request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon })));
            expect(bulk.map(res => res.status)).toEqual([200, 200]);
            expect((await monthBills()).map(row => [row.carryover_amount, Number(row.final_amount)])).toEqual([[12300, 287000]]);
            expect(await creditLeft()).toBe(0);

            // 일괄 청구 + 학생별 청구 동시: 청구 하나
            await seed({ tuition: 300000, rate: 0, credit: 12300, bills: false });
            await Promise.all([request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon }),
                request(app()).post('/paca/payments/generate-monthly-for-student').send({ student_id: 1, year, month: mon })]);
            expect(await monthBills()).toHaveLength(1);
            expect(await creditLeft()).toBe(0);

            // 매달 자동 청구 동시 두 번(이번 달): 청구 하나
            await seed({ tuition: 300000, rate: 0, credit: 12300, bills: false });
            const log = jest.spyOn(console, 'log').mockImplementation(() => {});
            const { generateMonthlyPayments } = require('../../scheduler/paymentScheduler');
            await Promise.all([generateMonthlyPayments(), generateMonthlyPayments()]);
            log.mockRestore();
            const [thisMonth] = await pool.query("SELECT carryover_amount FROM student_payments WHERE `year_month` = ? AND payment_type = 'monthly'", [THIS_MONTH]);
            expect(thisMonth.map(row => row.carryover_amount)).toEqual([12300]);
            expect(await creditLeft()).toBe(0);

            // 미리 납부 동시 두 번: 청구 하나(완납), 뒤 요청은 400
            await seed({ tuition: 300000, rate: 0, bills: false });
            const early = await Promise.all([1, 2].map(() =>
                request(app()).post('/paca/payments/early-pay').send({ student_id: 1, year_month: month, payment_method: 'cash' })));
            expect(early.map(res => res.status).sort()).toEqual([200, 400]);
            expect((await monthBills()).map(row => row.payment_status)).toEqual(['paid']);

            // 선납 동시 두 번: 달마다 청구 하나
            await seed({ tuition: 300000, rate: 0, bills: false });
            const months = [month, koreaMonth(3)];
            await Promise.all([1, 2].map(() => request(app()).post('/paca/payments/prepaid-pay')
                .send({ student_id: 1, months, prepaid_discount_rate: 5, payment_method: 'cash' })));
            const [prepaid] = await pool.query('SELECT `year_month` AS ym, COUNT(*) AS n FROM student_payments GROUP BY `year_month` ORDER BY ym');
            expect(prepaid.map(row => [row.ym, row.n])).toEqual(months.map(ym => [ym, 1]));

            // 청구 직접 만들기 동시 두 번(월 청구): 201·409, 청구 하나. 시즌비는 같은 달에도 만든다
            await seed({ tuition: 300000, rate: 0, bills: false });
            const create = type => request(app()).post('/paca/payments')
                .send({ student_id: 1, payment_type: type, base_amount: 300000, due_date: `${month}-05`, year_month: month });
            expect((await Promise.all([create('monthly'), create('monthly')])).map(res => res.status).sort()).toEqual([201, 409]);
            expect((await create('season')).status).toBe(201);
            const [byType] = await pool.query('SELECT payment_type, COUNT(*) AS n FROM student_payments WHERE `year_month` = ? GROUP BY payment_type ORDER BY payment_type', [month]);
            expect(byType.map(row => [row.payment_type, row.n])).toEqual([['monthly', 1], ['season', 1]]);
        } finally {
            await pool.query('DELETE FROM student_payments');
            await admin.query('ALTER TABLE student_payments ADD UNIQUE KEY uq_student_month_type (student_id, `year_month`, payment_type)');
        }
    });

    test('첫 달 일할·휴원 정산·휴원 복귀 청구가 있는 달에 일괄·자동 청구를 다시 돌려도 금액 그대로(건너뜀)', async () => {
        const [year, mon] = THIS_MONTH.split('-').map(Number);
        const transaction = async work => {
            const conn = await pool.getConnection();
            try { await conn.beginTransaction(); const out = await work(conn); await conn.commit(); return out; }
            catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
        };
        const { pause } = require('../../services/studentLifecycleBillingService');
        const { processResumePayment } = require('../../services/resumePaymentService');
        const { generateMonthlyPayments } = require('../../scheduler/paymentScheduler');
        const fullBill = () => pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type, base_amount,
            discount_amount, additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status, description)
            VALUES (1, 1, 1, ?, 'monthly', 450000, 0, 0, 0, 450000, 0, 0, ?, 'pending', ?)`, [THIS_MONTH, `${THIS_MONTH}-05`, `${mon}월 학원비`]);
        const kinds = {
            '첫 달 일할': async () => pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type, base_amount,
                discount_amount, additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status, description)
                VALUES (1, 1, 1, ?, 'monthly', 225000, 0, 0, 0, 225000, 0, 1, ?, 'pending', ?)`, [THIS_MONTH, `${THIS_MONTH}-16`, `${mon}월 학원비 (16일 등록, 일할계산)`]),
            '휴원 정산': async () => {
                await fullBill();
                await transaction(conn => pause(conn, { academyId: 1, studentId: 1, userId: 1, date: `${THIS_MONTH}-16`, creditType: 'none' }));
            },
            '휴원 복귀': async () => {
                await fullBill();
                await transaction(conn => pause(conn, { academyId: 1, studentId: 1, userId: 1, date: `${THIS_MONTH}-16`, creditType: 'none' }));
                const [[student]] = await pool.query('SELECT * FROM students WHERE id = 1');
                await transaction(connection => processResumePayment({ connection, student: { ...student, rest_start_date: `${THIS_MONTH}-16` },
                    resumeDate: `${THIS_MONTH}-21`, classDays: [1, 3, 5], creditRecalculation: null, recordedBy: 1 }));
            },
        };
        const snapshot = async () => (await pool.query('SELECT base_amount, discount_amount, final_amount, is_prorated, description FROM student_payments WHERE id = 1'))[0][0];
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        for (const [kind, make] of Object.entries(kinds)) {
            await seed({ tuition: 450000, rate: 0, bills: false });
            await make();
            const before = await snapshot();
            expect([kind, Number(before.final_amount) < 450000]).toEqual([kind, true]);
            const bulk = await request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon });
            expect([kind, bulk.body.skipped, bulk.body.updated]).toEqual([kind, 1, 0]);
            expect(await snapshot()).toEqual(before);
            await generateMonthlyPayments();
            expect(await snapshot()).toEqual(before);
            expect((await pool.query("SELECT COUNT(*) AS n FROM student_payments WHERE `year_month` = ? AND payment_type = 'monthly'", [THIS_MONTH]))[0][0].n).toBe(1);
        }
        log.mockRestore();
    });

    test('일부 납부 50,000원 청구를 선납·미리 납부 → 그 청구 매출 합계 = 최종 금액(두 번 잡히지 않음), paid_amount = 최종 금액', async () => {
        const [m1, m2] = [koreaMonth(2), koreaMonth(3)];
        const pendingBill = () => pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type, base_amount,
            discount_amount, additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status)
            VALUES (1, 1, 1, ?, 'monthly', 300000, 0, 0, 0, 300000, 0, 0, ?, 'pending')`, [m1, `${m1}-05`]);
        const ledger = async () => (await pool.query(`SELECT p.\`year_month\` AS ym, p.final_amount, p.paid_amount, p.payment_status,
            (SELECT COALESCE(SUM(r.amount), 0) FROM revenues r WHERE r.payment_id = p.id) AS revenue
            FROM student_payments p ORDER BY p.\`year_month\``))[0].map(row => [row.ym, Number(row.final_amount), Number(row.paid_amount), row.payment_status, Number(row.revenue)]);
        const partialPay = async () => {
            const res = await request(app()).post('/paca/payments/1/pay').send({ paid_amount: 50000, payment_method: 'cash' });
            expect([res.status, res.body.payment?.payment_status]).toEqual([200, 'partial']);
        };

        // 선납 2개월 5%: 285,000원씩, 일부 납부 50,000원 청구는 235,000원만 더 받는다
        await seed({ tuition: 300000, rate: 0, bills: false });
        await pool.query('DELETE FROM revenues');
        await pendingBill();
        await partialPay();
        const body = { student_id: 1, months: [m1, m2], prepaid_discount_rate: 5, payment_method: 'cash' };
        const preview = await request(app()).post('/paca/payments/prepaid-preview').send(body);
        expect([preview.body.months[0].paid_amount, preview.body.total_final]).toEqual([50000, 235000 + 285000]);
        const paid = await request(app()).post('/paca/payments/prepaid-pay').send(body);
        expect(paid.body.total_amount).toBe(235000 + 285000);
        expect(await ledger()).toEqual([[m1, 285000, 285000, 'paid', 285000], [m2, 285000, 285000, 'paid', 285000]]);

        // 미리 납부: 300,000원 청구에 일부 납부 50,000원 → 250,000원만 매출
        await seed({ tuition: 300000, rate: 0, bills: false });
        await pool.query('DELETE FROM revenues');
        await pendingBill();
        await partialPay();
        const early = await request(app()).post('/paca/payments/early-pay').send({ student_id: 1, year_month: m1, payment_method: 'cash' });
        expect([early.body.final_amount, early.body.received_amount]).toEqual([300000, 250000]);
        expect(await ledger()).toEqual([[m1, 300000, 300000, 'paid', 300000]]);

        // 이미 낸 금액이 선납 금액보다 많으면 막고 아무것도 바꾸지 않는다
        await seed({ tuition: 300000, rate: 0, bills: false });
        await pool.query('DELETE FROM revenues');
        await pendingBill();
        expect((await request(app()).post('/paca/payments/1/pay').send({ paid_amount: 290000, payment_method: 'cash' })).status).toBe(200);
        const blocked = await request(app()).post('/paca/payments/prepaid-pay').send(body);
        expect(blocked.status).toBe(400);
        expect(await ledger()).toEqual([[m1, 300000, 290000, 'partial', 290000]]);
    });

    test('청구 수정 화면: 따로 정한 청구의 기본 금액 변경 400·금액 그대로, 메모만 그대로, 추가 +10,000원은 그만큼, 보통 청구 크레딧 미리보기 = 저장', async () => {
        const month = koreaMonth(2);
        const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
        const { pause } = require('../../services/studentLifecycleBillingService');
        const { billFinalAfterChange } = require('../../utils/monthlyBillAmounts');
        const conn = await pool.getConnection();
        await seed({ tuition: 450000, rate: 0, bills: false });
        await pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type, base_amount, discount_amount,
            additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status)
            VALUES (1, 1, 1, ?, 'monthly', 450000, 0, 0, 0, 450000, 0, 0, ?, 'pending')`, [month, `${month}-05`]);
        try { await conn.beginTransaction(); await pause(conn, { academyId: 1, studentId: 1, userId: 1, date: `${month}-16`, creditType: 'none' }); await conn.commit(); }
        finally { conn.release(); }
        const paused = floorRatio(450000, 15, days);
        const final = async () => Number((await pool.query('SELECT final_amount FROM student_payments WHERE id = 1'))[0][0].final_amount);

        const view = (await request(app()).get('/paca/payments/1')).body.payment;
        expect([view.separately_priced, view.credit_amount, Number(view.final_amount)]).toEqual([true, 0, paused]);
        // 기본 금액을 줄인 금액으로 고치면(예전엔 0원) 400, 금액 그대로
        const blocked = await request(app()).put('/paca/payments/1').send({ base_amount: paused, discount_amount: 0, additional_amount: 0 });
        expect(blocked.status).toBe(400);
        expect(await final()).toBe(paused);
        // 메모만(화면이 예전처럼 금액 칸을 같은 값으로 보내도) 그대로
        expect((await request(app()).put('/paca/payments/1').send({ base_amount: 450000, discount_amount: 0, additional_amount: 0, notes: '메모' })).status).toBe(200);
        expect(await final()).toBe(paused);
        // 추가 +10,000원 → 그만큼 (화면 미리보기 함수 = 서버 함수, test/bill-amounts-parity.test.mjs)
        const preview = billFinalAfterChange(view, { additional_amount: 10000 });
        expect((await request(app()).put('/paca/payments/1').send({ additional_amount: 10000 })).status).toBe(200);
        expect([preview, await final()]).toEqual([paused + 10000, paused + 10000]);

        // 보통 청구 + 크레딧 166,500원: 미리보기(추가 10,000원) = 저장 금액 293,000원
        await seed({ tuition: 450000, rate: 0, bills: false });
        await pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type, base_amount, discount_amount,
            additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status)
            VALUES (1, 1, 1, ?, 'monthly', 450000, 0, 0, 166500, 283000, 0, 0, ?, 'pending')`, [month, `${month}-05`]);
        const normal = (await request(app()).get('/paca/payments/1')).body.payment;
        expect([normal.separately_priced, normal.credit_amount]).toEqual([false, 166500]);
        const normalPreview = billFinalAfterChange(normal, { additional_amount: 10000 });
        expect((await request(app()).put('/paca/payments/1').send({ additional_amount: 10000 })).status).toBe(200);
        expect([normalPreview, await final()]).toEqual([293000, 293000]);
    });

    test('첫 달·비시즌·복귀 일할, 휴원 정산 청구가 있는 달에 선납·미리 납부 → 그 청구 금액 기준(학원비 칸 그대로), 보통 청구는 전과 같음', async () => {
        const [m1, m2] = [koreaMonth(2), koreaMonth(3)];
        const days = new Date(Date.UTC(Number(m1.slice(0, 4)), Number(m1.slice(5)), 0)).getUTCDate();
        const transaction = async work => {
            const conn = await pool.getConnection();
            try { await conn.beginTransaction(); const out = await work(conn); await conn.commit(); return out; }
            catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
        };
        const { pause } = require('../../services/studentLifecycleBillingService');
        const { processResumePayment } = require('../../services/resumePaymentService');
        const { floorPercent } = require('../../utils/monthlyBillAmounts');
        const insertBill = (base, final, prorated, description) => pool.query(`INSERT INTO student_payments (id, student_id, academy_id,
            \`year_month\`, payment_type, base_amount, discount_amount, additional_amount, carryover_amount, final_amount, paid_amount, is_prorated,
            due_date, payment_status, description) VALUES (1, 1, 1, ?, 'monthly', ?, 0, 0, 0, ?, 0, ?, ?, 'pending', ?)`,
        [m1, base, final, prorated, `${m1}-05`, description]);
        const kinds = {
            '첫 달 일할': () => insertBill(60000, 60000, 1, `${Number(m1.slice(5))}월 학원비 (20일 등록, 일할계산)`),
            '비시즌 종강 일할': () => insertBill(120000, 120000, 0, `${Number(m1.slice(5))}월 학원비 (비시즌 종강 일할)`),
            '휴원 정산': async () => {
                await insertBill(450000, 450000, 0, '학원비');
                await transaction(conn => pause(conn, { academyId: 1, studentId: 1, userId: 1, date: `${m1}-16`, creditType: 'none' }));
            },
            '휴원 복귀': async () => {
                await insertBill(450000, 450000, 0, '학원비');
                await transaction(conn => pause(conn, { academyId: 1, studentId: 1, userId: 1, date: `${m1}-16`, creditType: 'none' }));
                const [[student]] = await pool.query('SELECT * FROM students WHERE id = 1');
                await transaction(connection => processResumePayment({ connection, student: { ...student, rest_start_date: `${m1}-16` },
                    resumeDate: `${m1}-21`, classDays: [1, 3, 5], creditRecalculation: null, recordedBy: 1 }));
            },
            '보통 청구': () => insertBill(450000, 450000, 0, '학원비'),
        };
        const expected = { '첫 달 일할': 60000, '비시즌 종강 일할': 120000, '휴원 정산': floorRatio(450000, 15, days),
            '휴원 복귀': floorRatio(450000, 15 + days - 20, days), '보통 청구': 450000 };
        const row = async () => (await pool.query('SELECT base_amount, discount_amount, final_amount, paid_amount, payment_status FROM student_payments WHERE id = 1'))[0][0];
        for (const [kind, make] of Object.entries(kinds)) {
            const amount = expected[kind];
            // 선납 2개월 5%: 이 청구는 그 청구 금액 − 그 금액 × 5%(천원 절삭), 다음 달 새 청구는 450,000 − 22,000
            await seed({ tuition: 450000, rate: 0, bills: false });
            await make();
            expect([kind, Number((await row()).final_amount)]).toEqual([kind, amount]);
            const body = { student_id: 1, months: [m1, m2], prepaid_discount_rate: 5, payment_method: 'cash' };
            const want = kind === '보통 청구' ? 428000 : amount - floorPercent(amount, 5);
            const preview = await request(app()).post('/paca/payments/prepaid-preview').send(body);
            expect([kind, preview.body.months[0].final_amount, preview.body.months[0].prepaid_discount]).toEqual([kind, want, amount - want]);
            const paid = await request(app()).post('/paca/payments/prepaid-pay').send(body);
            expect([kind, paid.status, paid.body.total_amount]).toEqual([kind, 200, want + 428000]);
            const after = await row();
            expect([kind, Number(after.base_amount), Number(after.discount_amount), Number(after.final_amount), Number(after.paid_amount), after.payment_status])
                .toEqual([kind, kind === '보통 청구' ? 450000 : (kind === '첫 달 일할' ? 60000 : kind === '비시즌 종강 일할' ? 120000 : 450000), amount - want, want, want, 'paid']);

            // 미리 납부: 그 청구 금액 그대로(보통 청구는 학생 월 학원비)
            await seed({ tuition: 450000, rate: 0, bills: false });
            await make();
            const early = await request(app()).post('/paca/payments/early-pay').send({ student_id: 1, year_month: m1, payment_method: 'cash' });
            expect([kind, early.body.final_amount]).toEqual([kind, amount]);
            const afterEarly = await row();
            expect([kind, Number(afterEarly.final_amount), Number(afterEarly.paid_amount), afterEarly.payment_status]).toEqual([kind, amount, amount, 'paid']);
        }
    });

    test('추가 50,000원 붙은 청구를 3일 휴원으로 33,000원으로 줄인 달 선납 5% → 할인 0, 33,000원 그대로, 할인 칸 음수 없음', async () => {
        const [m1, m2] = [koreaMonth(2), koreaMonth(3)];
        await seed({ tuition: 450000, rate: 0, bills: false });
        await pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type, base_amount, discount_amount,
            additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status, description)
            VALUES (1, 1, 1, ?, 'monthly', 450000, 0, 50000, 0, 33000, 0, 1, ?, 'pending', '휴원 정산')`, [m1, `${m1}-05`]);
        const body = { student_id: 1, months: [m1, m2], prepaid_discount_rate: 5, payment_method: 'cash' };
        const preview = await request(app()).post('/paca/payments/prepaid-preview').send(body);
        expect([preview.body.months[0].prepaid_discount, preview.body.months[0].final_amount]).toEqual([0, 33000]);
        expect((await request(app()).post('/paca/payments/prepaid-pay').send(body)).status).toBe(200);
        const [[row]] = await pool.query('SELECT discount_amount, final_amount, paid_amount, payment_status FROM student_payments WHERE id = 1');
        expect([Number(row.discount_amount), Number(row.final_amount), Number(row.paid_amount), row.payment_status]).toEqual([0, 33000, 33000, 'paid']);
        expect((await pool.query('SELECT COUNT(*) AS n FROM student_payments WHERE discount_amount < 0'))[0][0].n).toBe(0);
    });

    test('시즌 등록 → 시즌 이름 변경 → 등록 취소: season_id 로 이은 미납 시즌비 청구도 지워진다(예전엔 50,000원 남음)', async () => {
        const month = koreaMonth(2);
        await seed({ tuition: 450000, rate: 0, bills: false });
        await pool.query(`INSERT INTO seasons (id, academy_id, season_name, season_type, non_season_end_date, season_start_date, season_end_date,
            operating_days, default_season_fee, season_monthly_policy) VALUES (29, 1, 'QA-지점수시', 'regular', ?, ?, ?, '[1,3,5]', 50000, 'season_replaces_monthly')`,
        [`${month}-01`, `${month}-02`, `${month}-28`]);
        await pool.query(`INSERT INTO student_seasons (id, student_id, season_id, season_fee, registration_date, payment_status)
            VALUES (214, 1, 29, 50000, ?, 'pending')`, [`${month}-01`]);
        await pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type, season_id, base_amount, discount_amount,
            additional_amount, final_amount, paid_amount, is_prorated, due_date, payment_status, description)
            VALUES (8503, 1, 1, ?, 'season', 29, 50000, 0, 0, 50000, 0, 0, ?, 'pending', 'QA-지점수시 시즌비')`, [month, `${month}-02`]);
        await pool.query("UPDATE seasons SET season_name = 'QA-지점수시수정' WHERE id = 29");
        const res = await request(app()).post('/paca/seasons/enrollments/214/cancel').send({ cancellation_date: `${month}-01` });
        expect(res.status).toBe(200);
        expect((await pool.query('SELECT COUNT(*) AS n FROM student_seasons WHERE id = 214'))[0][0].n).toBe(0);
        expect((await pool.query('SELECT COUNT(*) AS n FROM student_payments WHERE id = 8503'))[0][0].n).toBe(0);
        await pool.query('DELETE FROM seasons');
    });

    test('미리 납부 확인 창 금액(early-pay-preview) = 실제 미리 납부 금액 — 복귀 375,000 같은 조정 청구, 추가·크레딧 청구, 새 청구', async () => {
        const month = koreaMonth(2);
        const cases = [
            ['따로 정한 청구', [450000, 0, 0, 375000, 1, '학원비'], 375000],
            ['추가·크레딧 청구', [450000, 10000, 166500, 293000, 0, '학원비'], 293000],
            ['새 청구', null, 450000],
        ];
        for (const [label, row, want] of cases) {
            await seed({ tuition: 450000, rate: 0, bills: false });
            if (row) await pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type, base_amount, discount_amount,
                additional_amount, carryover_amount, final_amount, paid_amount, is_prorated, due_date, payment_status, description)
                VALUES (1, 1, 1, ?, 'monthly', ?, 0, ?, ?, ?, 0, ?, ?, 'pending', ?)`, [month, row[0], row[1], row[2], row[3], row[4], `${month}-05`, row[5]]);
            const preview = await request(app()).post('/paca/payments/early-pay-preview').send({ student_id: 1, year_month: month });
            expect([label, preview.status, preview.body.final_amount, preview.body.received_amount]).toEqual([label, 200, want, want]);
            const paid = await request(app()).post('/paca/payments/early-pay').send({ student_id: 1, year_month: month, payment_method: 'cash' });
            expect([label, paid.body.final_amount, paid.body.received_amount]).toEqual([label, want, want]);
            const again = await request(app()).post('/paca/payments/early-pay-preview').send({ student_id: 1, year_month: month });
            expect([label, again.body.status]).toEqual([label, 'already_paid']);
        }
    });

    test('마이그레이션 20261119: 옛 season_settings 외래 키를 지우고 예전 시즌비 청구에 season_id 를 채운다', async () => {
        const month = koreaMonth(2);
        const runMigration = async () => {
            const sql = fs.readFileSync(path.join(__dirname, '../../migrations/20261119_fix_season_payment_link.mysql'), 'utf8');
            for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await admin.query(statement);
        };
        // 운영 형태: season_id 가 비어 있는 season_settings 를 가리키는 외래 키 → 시즌 id 를 넣으면 실패
        await admin.query('CREATE TABLE IF NOT EXISTS season_settings (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY) ENGINE=InnoDB');
        await admin.query('ALTER TABLE student_payments ADD CONSTRAINT student_payments_ibfk_3 FOREIGN KEY (season_id) REFERENCES season_settings (id) ON DELETE SET NULL');
        try {
            await seed({ tuition: 450000, rate: 0, bills: false });
            await pool.query(`INSERT INTO seasons (id, academy_id, season_name, season_type, non_season_end_date, season_start_date, season_end_date,
                operating_days, default_season_fee, season_monthly_policy) VALUES (31, 1, '여름 정시', 'regular', ?, ?, ?, '[1,3,5]', 50000, 'season_replaces_monthly'),
                (32, 1, '여름 정시 심화', 'regular', ?, ?, ?, '[1,3,5]', 50000, 'season_replaces_monthly')`,
            [`${month}-01`, `${month}-02`, `${month}-28`, `${month}-01`, `${month}-02`, `${month}-28`]);
            await pool.query(`INSERT INTO student_seasons (id, student_id, season_id, season_fee, registration_date, payment_status)
                VALUES (301, 1, 31, 50000, ?, 'pending')`, [`${month}-01`]);
            const legacy = (id, ym, description) => pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type,
                base_amount, discount_amount, additional_amount, final_amount, paid_amount, is_prorated, due_date, payment_status, description)
                VALUES (?, 1, 1, ?, 'season', 50000, 0, 0, 50000, 0, 0, ?, 'pending', ?)`, [id, ym, `${ym}-02`, description]);
            await legacy(9001, month, '여름 정시 시즌비'); // 등록 있는 시즌 하나와만 맞음 → 채움
            await legacy(9002, koreaMonth(3), '없어진 시즌 시즌비'); // 맞는 등록 없음 → 그대로(남은 청구 조회 대상)
            await expect(pool.query("UPDATE student_payments SET season_id = 31 WHERE id = 9001")).rejects.toThrow(/foreign key/i);

            await runMigration();
            const [rows] = await pool.query('SELECT id, season_id FROM student_payments ORDER BY id');
            expect(rows.map(row => [row.id, row.season_id])).toEqual([[9001, 31], [9002, null]]);
            // 이제 새 시즌비 청구에 season_id 를 넣을 수 있다
            await pool.query('UPDATE student_payments SET season_id = 32 WHERE id = 9002');
            await runMigration(); // 두 번 돌려도 된다
        } finally {
            await pool.query('DELETE FROM student_payments');
            await pool.query('DELETE FROM student_seasons');
            await pool.query('DELETE FROM seasons');
            const [fk] = await admin.query(`SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'student_payments' AND REFERENCED_TABLE_NAME = 'season_settings'`);
            for (const row of fk) await admin.query(`ALTER TABLE student_payments DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
            await admin.query('DROP TABLE IF EXISTS season_settings');
        }
    });

    test('같은 달 미납 청구를 일괄 청구·자동 청구로 다시 돌려도 추가 금액 10,000원은 남고 최종 금액에 들어간다', async () => {
        const [year, mon] = THIS_MONTH.split('-').map(Number);
        const pendingBill = (carryover, final) => pool.query(`INSERT INTO student_payments (id, student_id, academy_id, \`year_month\`, payment_type,
            base_amount, discount_amount, additional_amount, carryover_amount, rest_credit_id, final_amount, paid_amount, is_prorated, due_date, payment_status)
            VALUES (1, 1, 1, ?, 'monthly', 450000, 0, 10000, ?, ?, ?, 0, 0, ?, 'pending')`, [THIS_MONTH, carryover, carryover ? 1 : null, final, `${THIS_MONTH}-05`]);
        const monthBill = async () => {
            const [[row]] = await pool.query('SELECT additional_amount, carryover_amount, final_amount FROM student_payments WHERE id = 1');
            return [Number(row.additional_amount), Number(row.carryover_amount), Number(row.final_amount)];
        };
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const { generateMonthlyPayments } = require('../../scheduler/paymentScheduler');
        for (const [carryover, final] of [[0, 460000], [166500, 293000]]) {
            // 일괄 청구
            await seed({ tuition: 450000, rate: 0, credit: carryover, bills: false });
            if (carryover) await pool.query("UPDATE rest_credits SET remaining_amount = 0, status = 'applied'"); // 이미 이 청구에 적용됨
            await pendingBill(carryover, final);
            expect((await request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon })).body).toMatchObject({ updated: 1 });
            expect(await monthBill()).toEqual([10000, carryover, final]);
            expect(final).toBe(monthlyBillAmounts(450000, 0, 10000, carryover).final);

            // 매달 자동 청구
            await seed({ tuition: 450000, rate: 0, credit: carryover, bills: false });
            if (carryover) await pool.query("UPDATE rest_credits SET remaining_amount = 0, status = 'applied'");
            await pendingBill(carryover, final);
            await generateMonthlyPayments();
            expect(await monthBill()).toEqual([10000, carryover, final]);
        }
        log.mockRestore();
    });

    test('크레딧: 같은 달 일괄 청구를 두 번 돌려도, 학생별 청구를 동시에 두 번 눌러도 크레딧은 한 번만', async () => {
        const month = koreaMonth(2), [year, mon] = month.split('-').map(Number);
        const creditState = async () => (await pool.query('SELECT remaining_amount FROM rest_credits WHERE id = 1'))[0][0].remaining_amount;
        const monthBills = async () => (await pool.query('SELECT carryover_amount, rest_credit_id, final_amount FROM student_payments WHERE `year_month` = ?', [month]))[0];

        // 일괄 청구 두 번(같은 달, 미납 청구가 남아 있는 상태에서 다시): 앞에서 적용한 크레딧을 그대로 두고 또 빼지 않는다
        await seed({ tuition: 300000, rate: 0, credit: 100000, bills: false });
        await pool.query(`INSERT INTO rest_credits (id, student_id, academy_id, rest_start_date, rest_end_date, rest_days, credit_amount,
            remaining_amount, credit_type, status, created_at) VALUES (2, 1, 1, '2026-02-01', '2026-02-10', 10, 5000, 5000, 'manual', 'pending', NOW())`);
        expect((await request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon })).status).toBe(200);
        expect((await request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon })).status).toBe(200);
        const [after] = await monthBills();
        expect([after.carryover_amount, after.rest_credit_id, Number(after.final_amount)]).toEqual([100000, 1, 200000]);
        expect(await creditState()).toBe(0);
        expect((await pool.query('SELECT remaining_amount FROM rest_credits WHERE id = 2'))[0][0].remaining_amount).toBe(5000);

        // 학생별 청구를 동시에 두 번: 청구 하나, 크레딧 한 번
        await seed({ tuition: 300000, rate: 0, credit: 12300, bills: false });
        const responses = await Promise.all([1, 2].map(() =>
            request(app()).post('/paca/payments/generate-monthly-for-student').send({ student_id: 1, year, month: mon })));
        expect(responses.map(res => res.status).sort()).toEqual([201, 400]);
        expect((await monthBills()).map(row => row.carryover_amount)).toEqual([12300]);
        expect(await creditState()).toBe(0);

        // 일괄 청구를 동시에 두 번: 청구 하나, 크레딧 합 보존(빠진 크레딧 = 청구에 적힌 크레딧)
        await seed({ tuition: 300000, rate: 0, credit: 12300, bills: false });
        await Promise.all([1, 2].map(() => request(app()).post('/paca/payments/bulk-monthly').send({ year, month: mon })));
        const bills = await monthBills();
        expect(bills).toHaveLength(1);
        expect(12300 - await creditState()).toBe(bills[0].carryover_amount);
        expect(bills[0].carryover_amount).toBe(12300);
    });
});
