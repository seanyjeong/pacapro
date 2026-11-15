/**
 * 수입 합계(대시보드 이번 달 수입·수입 엑셀)에 부분 납부가 받은 금액만큼 들어가는지 일회용 MySQL 8 에서 실제로 돌린다 (QA P01).
 * 표는 max-engine-schema.json(운영 칸 형식)으로 만들고, 지점 칸은 저장소 마이그레이션을 그대로 적용한다.
 * RUN_MAX_ENGINE_MYSQL=1 TEST_MYSQL_PORT=<10000 이상 전용 포트> 일 때만 돈다. 운영 자격 증명·실제 학생 없음.
 */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__incomePartialMysql);
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
const ExcelJS = require('exceljs');
const schema = require('./max-engine-schema.json');

const database = 'income_partial_mysql_test';
const TABLES = ['academies', 'classes', 'students', 'student_payments', 'rest_credits', 'other_incomes', 'expenses', 'instructors'];
const MIGRATIONS = ['20261112_add_branches_and_student_class.mysql', '20261113_add_student_payment_branch.mysql'];
const koreaMonth = offset => {
    const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
};
const THIS_MONTH = koreaMonth(0), LAST_MONTH = koreaMonth(-1);

function binaryParser(res, callback) {
    res.setEncoding('binary');
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}

run('수입 합계의 부분 납부 — 실제 MySQL 8', () => {
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
        global.__incomePartialMysql = pool;

        // 손 계산: 완납 200,000 + 완납(받은 금액 빈 옛 자료) 150,000 + 부분 납부 50,000 = 학원비 400,000
        //          + 기타 수입 24,000 = 수입 424,000, 지출 48,000 → 순이익 376,000
        await pool.query(`INSERT INTO students (id, academy_id, name, student_type, grade, admission_type, class_days, weekly_count,
            monthly_tuition, discount_rate, status, is_trial, time_slot, enrollment_date, payment_due_day) VALUES
            (1, 1, '합성 완납', 'exam', '고3', 'regular', '[1]', 1, 200000, 0, 'active', 0, 'evening', '2026-01-02', 5),
            (2, 1, '합성 옛 완납', 'exam', '고3', 'regular', '[1]', 1, 150000, 0, 'active', 0, 'evening', '2026-01-02', 5),
            (3, 1, '합성 부분', 'exam', '고3', 'regular', '[1]', 1, 293000, 0, 'active', 0, 'evening', '2026-01-02', 5),
            (4, 1, '합성 미납', 'exam', '고3', 'regular', '[1]', 1, 100000, 0, 'active', 0, 'evening', '2026-01-02', 5)`);
        const bill = (id, studentId, final, paid, status, paidDate) => pool.query(`INSERT INTO student_payments
            (id, student_id, academy_id, \`year_month\`, payment_type, base_amount, discount_amount, final_amount, paid_amount,
             is_prorated, due_date, payment_status, paid_date, payment_method) VALUES (?, ?, 1, ?, 'monthly', ?, 0, ?, ?, 0, ?, ?, ?, 'cash')`,
        [id, studentId, THIS_MONTH, final, final, paid, `${THIS_MONTH}-05`, status, paidDate]);
        await bill(1, 1, 200000, 200000, 'paid', `${THIS_MONTH}-05`);
        await bill(2, 2, 150000, 0, 'paid', `${THIS_MONTH}-06`);
        await bill(3, 3, 293000, 50000, 'partial', `${THIS_MONTH}-10`);
        await bill(4, 4, 100000, 0, 'pending', null);
        await bill(5, 4, 100000, 100000, 'paid', `${LAST_MONTH}-28`); // 지난달에 받은 돈 — 이번 달 수입 아님
        await pool.query("INSERT INTO other_incomes (id, academy_id, income_date, category, amount) VALUES (1, 1, ?, 'other', 24000)", [`${THIS_MONTH}-12`]);
        await pool.query("INSERT INTO expenses (id, academy_id, expense_date, category, amount) VALUES (1, 1, ?, 'other', 48000)", [`${THIS_MONTH}-12`]);
    });
    afterAll(async () => {
        await admin?.query(`DROP DATABASE IF EXISTS ${database}`);
        await pool?.end(); await admin?.end();
    });

    const app = () => {
        const a = express(); a.use(express.json());
        a.use('/paca/reports', require('../../routes/reports'));
        const exportsRouter = express.Router(); require('../../routes/exports/revenue')(exportsRouter); require('../../routes/exports/financial')(exportsRouter);
        a.use('/paca/exports', exportsRouter);
        const payments = express.Router(); require('../../routes/payments/list')(payments); a.use('/paca/payments', payments);
        return a;
    };

    test('대시보드 이번 달 수입 = 완납 + 부분 납부의 받은 금액 + 기타 수입', async () => {
        const res = await request(app()).get('/paca/reports/dashboard');
        expect(res.status).toBe(200);
        expect(res.body.current_month.revenue).toEqual({ count: 4, amount: 424000 });
        expect(res.body.current_month.net_income).toBe(376000);
    });

    test('수입 엑셀: 학원비 시트에 부분 납부 줄이 받은 금액으로 들어가고 합계가 손 계산과 같다', async () => {
        const [year, month] = THIS_MONTH.split('-');
        const res = await request(app()).get(`/paca/exports/revenue?year=${year}&month=${Number(month)}`).buffer(true).parse(binaryParser);
        expect(res.status).toBe(200);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(res.body);
        const tuitionAmounts = [];
        workbook.getWorksheet('학원비 수입').eachRow((row, rowNumber) => { if (rowNumber > 1) tuitionAmounts.push([row.getCell(2).value, row.getCell(4).value]); });
        expect(tuitionAmounts).toEqual([['합성 부분', 50000], ['합성 옛 완납', 150000], ['합성 완납', 200000], ['', 400000]]);
        const summary = {};
        workbook.getWorksheet('수입 요약').eachRow((row, rowNumber) => { if (rowNumber > 1) summary[row.getCell(1).value] = row.getCell(2).value; });
        expect(summary).toEqual({ '학원비 수입': 400000, '기타 수입': 24000, '총 수입': 424000 });
    });

    test('연간 재무 엑셀: 이번 달 학원비·총 수입·총 지출이 손 계산과 같다', async () => {
        const [year, month] = THIS_MONTH.split('-');
        const res = await request(app()).get(`/paca/exports/financial?year=${year}`).buffer(true).parse(binaryParser);
        expect(res.status).toBe(200);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(res.body);
        const sheet = workbook.worksheets[0];
        const header = sheet.getRow(1).values;
        const col = name => header.indexOf(name);
        const row = sheet.getRow(Number(month) + 1);
        expect([row.getCell(col('학원비')).value, row.getCell(col('시즌비')).value, row.getCell(col('총 수입')).value, row.getCell(col('총 지출')).value])
            .toEqual([400000, 0, 424000, 48000]);
    });

    test('GET /payments 납부월 조회(상태 없이)는 그 달에 받은 완납·부분 납부를 모두 돌려준다 — 화면이 받은 금액으로 더한다', async () => {
        const [year, month] = THIS_MONTH.split('-');
        const res = await request(app()).get(`/paca/payments?paid_year=${year}&paid_month=${month}`);
        expect(res.status).toBe(200);
        expect(res.body.payments.map(p => [p.id, p.payment_status, Number(p.paid_amount)]).sort((a, b) => a[0] - b[0]))
            .toEqual([[1, 'paid', 200000], [2, 'paid', 0], [3, 'partial', 50000]]);
        // 상태 하나만 주는 기존 호출은 그대로
        const paidOnly = await request(app()).get(`/paca/payments?paid_year=${year}&paid_month=${month}&payment_status=paid`);
        expect(paidOnly.body.payments.map(p => p.id).sort()).toEqual([1, 2]);
        // 미납 칸: 쉼표로 미납 + 부분 납부를 한 번에(이번 달 청구)
        const unpaid = await request(app()).get(`/paca/payments?year=${year}&month=${Number(month)}&payment_status=pending,partial`);
        expect(unpaid.body.payments.map(p => p.id).sort()).toEqual([3, 4]);
    });
});
