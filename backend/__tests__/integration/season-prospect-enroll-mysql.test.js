/**
 * 예비생 시즌 등록을 일회용 MySQL 8 에서 실제로 돌린다 — 재원이 되고 시즌 규칙(시즌비 청구)만 따르며 월 학원비 청구는 만들지 않는다.
 * 표는 max-engine-schema.json(운영 칸 형식)으로 만들고 저장소 마이그레이션을 그대로 적용한다.
 * RUN_MAX_ENGINE_MYSQL=1 TEST_MYSQL_PORT=<10000 이상 전용 포트> 일 때만 돈다. 운영 자격 증명·실제 학생 없음.
 */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__seasonProspectMysql);
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

const database = 'season_prospect_enroll_mysql_test';
const TABLES = ['academies', 'academy_settings', 'students', 'student_payments', 'classes', 'seasons', 'student_seasons', 'consultations'];
const MIGRATIONS = ['20260930_add_student_prospect_status.mysql', '20261001_add_season_aftercare.mysql', '20261112_add_branches_and_student_class.mysql',
    '20261113_add_student_payment_branch.mysql', '20261118_add_season_branch.mysql'];
const koreaMonth = offset => {
    const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
};

run('예비생 시즌 등록 — 실제 MySQL 8', () => {
    let admin, pool;
    beforeAll(async () => {
        const port = Number(process.env.TEST_MYSQL_PORT);
        if (!Number.isSafeInteger(port) || port < 10000) throw new Error('Dedicated TEST_MYSQL_PORT >=10000 required');
        const options = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true, timezone: '+09:00' };
        admin = await mysql.createConnection(options);
        await admin.query(`DROP DATABASE IF EXISTS ${database}`);
        await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);
        for (const table of TABLES) {
            const defs = schema[`paca.${table}`].map(([col, type, nullable]) => `\`${col}\` ${type} ${col === 'id' ? 'NOT NULL AUTO_INCREMENT PRIMARY KEY'
                : col === 'is_prorated' ? 'NOT NULL DEFAULT 0' : nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
            await admin.query(`CREATE TABLE ${database}.\`${table}\` (${defs.join(',')}) ENGINE=InnoDB`);
        }
        await admin.query(`USE ${database}`);
        for (const file of MIGRATIONS) {
            const sql = fs.readFileSync(path.join(__dirname, '../../migrations', file), 'utf8');
            for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await admin.query(statement);
        }
        pool = mysql.createPool({ ...options, database });
        global.__seasonProspectMysql = pool;
    });
    afterAll(async () => {
        await admin?.query(`DROP DATABASE IF EXISTS ${database}`);
        await pool?.end(); await admin?.end();
    });

    test('재원이 되고 시즌비만 청구한다(월 학원비 300,000원·주 3회여도 월 청구는 만들지 않는다)', async () => {
        const month = koreaMonth(2);
        await pool.query("INSERT INTO academies (id, owner_user_id, name, tuition_due_day) VALUES (1, 1, '합성 학원', 5)");
        await pool.query("INSERT INTO academy_settings (id, academy_id, tuition_due_day, settings) VALUES (1, 1, 5, '{}')");
        await pool.query(`INSERT INTO students (id, academy_id, name, student_type, grade, admission_type, class_days, weekly_count,
            monthly_tuition, discount_rate, status, is_trial, time_slot, enrollment_date, payment_due_day)
            VALUES (1, 1, '합성', 'exam', '고3', 'regular', '[1,3,5]', 3, 300000, 0, 'prospect', 0, 'evening', '2026-01-02', 5)`);
        await pool.query(`INSERT INTO seasons (id, academy_id, season_name, season_type, non_season_end_date, season_start_date, season_end_date,
            operating_days, default_season_fee, season_monthly_policy, status) VALUES (30, 1, 'QA-정시', 'regular', ?, ?, ?, '[1,3,5]', 3700000, 'season_replaces_monthly', 'active')`,
        [`${month}-01`, `${month}-02`, `${month}-28`]);
        const app = express(); app.use(express.json());
        const seasons = express.Router(); require('../../routes/seasons/enroll')(seasons); app.use('/paca/seasons', seasons);

        const res = await request(app).post('/paca/seasons/30/enroll').send({ student_id: 1, season_fee: 3700000, registration_date: `${month}-02` });
        expect(res.status).toBe(201);
        const [[student]] = await pool.query('SELECT status, is_season_registered, current_season_id FROM students WHERE id = 1');
        expect([student.status, Number(student.is_season_registered), student.current_season_id]).toEqual(['active', 1, 30]);
        const [rows] = await pool.query('SELECT payment_type, final_amount FROM student_payments WHERE student_id = 1');
        expect(rows.map(row => [row.payment_type, Number(row.final_amount)])).toEqual([['season', 3700000]]);
    });
});
