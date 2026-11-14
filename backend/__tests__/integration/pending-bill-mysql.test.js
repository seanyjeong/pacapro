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
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const express = require('express');
const request = require('supertest');
const schema = require('./max-engine-schema.json');
const { monthlyBillAmounts } = require('../../utils/monthlyBillAmounts');

const database = 'pending_bill_mysql_test';
const TABLES = ['academies', 'academy_settings', 'students', 'student_payments', 'rest_credits', 'classes', 'seasons', 'student_seasons',
    'instructors', 'consultations'];
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
        pool = mysql.createPool({ ...options, database, multipleStatements: false });
        pool.on('connection', connection => connection.query("SET time_zone = '+09:00'"));
        global.__pendingBillMysql = pool;
    });
    afterAll(async () => {
        await admin?.query(`DROP DATABASE IF EXISTS ${database}`);
        await pool?.end(); await admin?.end();
    });

    async function seed({ tuition, rate, classId = 9, classTable = 450000, academyWeekly2 = 450000, credit = 0 }) {
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
        await bill(1, THIS_MONTH, 'pending', '이번 달 학원비', '5000.50', 12300, '293000.00');
        await bill(2, LAST_MONTH, 'pending', '지난 달 학원비', '0.00', 0, '300000.00');
        await bill(3, NEXT_MONTH, 'pending', `${Number(NEXT_MONTH.slice(5))}월 학원비 (비시즌 종강 일할)`, '0.00', 0, '120000.00');
        if (credit) {
            await pool.query(`INSERT INTO rest_credits (id, student_id, academy_id, rest_start_date, rest_end_date, rest_days, credit_amount,
                remaining_amount, credit_type, status, created_at) VALUES (1, 1, 1, '2026-01-01', '2026-01-10', 10, ?, ?, 'carryover', 'pending', NOW())`,
            [credit, credit]);
        }
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
        const students = express.Router(); require('../../routes/students/classDays')(students); a.use('/paca/students', students);
        a.use('/paca/branches', require('../../routes/branches'));
        const payments = express.Router();
        require('../../routes/payments/bulk')(payments); require('../../routes/payments/bulk/monthlyForStudent')(payments);
        a.use('/paca/payments', payments);
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
});
