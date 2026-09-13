const mysql = require('mysql2/promise');
const mockPool = process.env.MAXAI_NATIVE_MYSQL_SOCKET ? mysql.createPool({
    socketPath: process.env.MAXAI_NATIVE_MYSQL_SOCKET,
    user: 'root', database: 'maxai_operations_fixture', dateStrings: true, connectionLimit: 4,
}) : null;
jest.mock('../../config/database', () => mockPool);
jest.mock('../../middleware/auth', () => ({
    verifyToken: (req, res, next) => { req.user = { academyId: 7, id: 9 }; next(); },
    checkPermission: () => (req, res, next) => next(),
}));
jest.mock('../../utils/encryption', () => ({ decrypt: (value) => value }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const request = require('supertest');
const express = require('express');
const suite = mockPool ? describe : describe.skip;

suite('native MySQL payment atomicity and attendance read contracts', () => {
    let app;
    beforeAll(async () => {
        app = express(); app.use(express.json());
        const payments = express.Router();
        require('../../routes/payments/pay')(payments);
        require('../../routes/payments/cancel')(payments);
        app.use('/paca/payments', payments);
        const schedules = express.Router();
        require('../../routes/schedules/attendance-state')(schedules);
        app.use('/paca/schedules', schedules);
        await mockPool.query(`CREATE TABLE students (
            id INT PRIMARY KEY, academy_id INT NOT NULL, name VARCHAR(100), student_number VARCHAR(20),
            grade VARCHAR(20), status VARCHAR(20), deleted_at DATETIME NULL, class_days JSON,
            time_slot VARCHAR(20), enrollment_date DATE NULL, is_trial INT DEFAULT 0, trial_remaining INT DEFAULT 0)`);
        await mockPool.query(`CREATE TABLE student_payments (
            id INT PRIMARY KEY, academy_id INT, student_id INT, payment_type VARCHAR(20),
            final_amount DECIMAL(12,2), paid_amount DECIMAL(12,2), discount_amount DECIMAL(12,2),
            payment_status VARCHAR(20), payment_method VARCHAR(20), paid_date DATE NULL,
            notes TEXT, description TEXT, updated_at DATETIME NULL)`);
        await mockPool.query(`CREATE TABLE revenues (
            id INT AUTO_INCREMENT PRIMARY KEY, academy_id INT NOT NULL,
            revenue_date DATE NOT NULL, category VARCHAR(100) NOT NULL, amount DECIMAL(10,2) NOT NULL,
            payment_id INT NULL, student_id INT NULL, description TEXT, notes TEXT,
            recorded_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await mockPool.query(`CREATE TABLE class_schedules (
            id INT PRIMARY KEY, academy_id INT, class_date DATE, time_slot VARCHAR(20), attendance_taken INT)`);
        await mockPool.query(`CREATE TABLE attendance (
            class_schedule_id INT, student_id INT, attendance_status VARCHAR(20), notes TEXT,
            makeup_date DATE NULL, is_makeup INT DEFAULT 0, PRIMARY KEY(class_schedule_id, student_id))`);
        await mockPool.query(`INSERT INTO students (id,academy_id,name,status,class_days,time_slot,enrollment_date)
            VALUES (101,7,'검증학생','active','[6]','morning','2026-09-01'),
                   (102,8,'다른학원','active','[6]','morning','2026-09-01'),
                   (103,7,'오후학생','active','[6]','afternoon','2026-09-01'),
                   (104,7,'미래등록','active','[6]','morning','2026-10-01'),
                   (105,7,'이동체험','trial','[]','afternoon','2026-09-01')`);
        await mockPool.query(`INSERT INTO class_schedules VALUES (701,7,'2026-09-12','morning',0)`);
        await mockPool.query(`INSERT INTO attendance VALUES (701,105,NULL,'보충 예정',NULL,1)`);
    });
    beforeEach(async () => {
        await mockPool.query('DROP TRIGGER IF EXISTS fail_revenue');
        await mockPool.query('DELETE FROM student_payments');
        await mockPool.query('DELETE FROM revenues');
        await mockPool.query(`INSERT INTO student_payments
            (id,academy_id,student_id,payment_type,final_amount,paid_amount,discount_amount,payment_status,notes)
            VALUES (901,7,101,'monthly',200000,0,0,'pending','기존 메모')`);
    });
    afterAll(async () => { if (mockPool) await mockPool.end(); });

    test.each(['card', 'account', 'cash'])('%s payment and cancellation use the production ledger schema', async (method) => {
        const paid = await request(app).post('/paca/payments/901/pay')
            .send({ paid_amount: 200000, payment_method: method, payment_date: '2026-09-13' });
        expect(paid.status).toBe(200);
        expect(paid.body.payment.payment_status).toBe('paid');
        expect(paid.body.payment.payment_method).toBe(method);
        const cancelled = await request(app).post('/paca/payments/901/cancel')
            .send({ cancel_amount: 200000, cancel_reason: '검증 취소', cancel_date: '2026-09-13' });
        expect(cancelled.status).toBe(200);
        expect(cancelled.body.payment.payment_status).toBe('pending');
        expect(Number(cancelled.body.payment.paid_amount)).toBe(0);
        const [ledger] = await mockPool.query(
            'SELECT academy_id, payment_id, student_id, amount, revenue_date FROM revenues ORDER BY id');
        expect(ledger.map(row => ({ ...row, amount: Number(row.amount) }))).toEqual([
            { academy_id: 7, payment_id: 901, student_id: 101, amount: 200000, revenue_date: '2026-09-13' },
            { academy_id: 7, payment_id: 901, student_id: 101, amount: -200000, revenue_date: '2026-09-13' },
        ]);
    });

    test('concurrent payments lock the row and preserve both ledger entries', async () => {
        const results = await Promise.all([1, 2].map(() => request(app).post('/paca/payments/901/pay')
            .send({ paid_amount: 50000, payment_method: 'cash', payment_date: '2026-09-12' })));
        expect(results.map((result) => result.status)).toEqual([200, 200]);
        const [[payment]] = await mockPool.query('SELECT * FROM student_payments WHERE id=901');
        const [[ledger]] = await mockPool.query('SELECT COUNT(*) AS count, SUM(amount) AS total FROM revenues');
        expect(Number(payment.paid_amount)).toBe(100000);
        expect(payment.payment_status).toBe('partial');
        expect(ledger.count).toBe(2); expect(Number(ledger.total)).toBe(100000);
    });
    test.each(['pay', 'cancel'])('%s rolls back payment changes if the ledger insert fails', async (action) => {
        if (action === 'cancel') await mockPool.query(`UPDATE student_payments
            SET paid_amount=100000, payment_status='partial', payment_method='cash' WHERE id=901`);
        const [[before]] = await mockPool.query('SELECT * FROM student_payments WHERE id=901');
        await mockPool.query(`CREATE TRIGGER fail_revenue BEFORE INSERT ON revenues FOR EACH ROW
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture ledger failure'`);
        const result = await request(app).post(`/paca/payments/901/${action}`).send(action === 'pay'
            ? { paid_amount: 50000, payment_method: 'cash' }
            : { cancel_amount: 50000, cancel_reason: '검증 취소' });
        expect(result.status).toBe(500);
        const [[after]] = await mockPool.query('SELECT * FROM student_payments WHERE id=901');
        expect(after).toEqual(before);
        const [[ledger]] = await mockPool.query('SELECT COUNT(*) AS count FROM revenues');
        expect(ledger.count).toBe(0);
    });
    test('attendance reads preserve storage and apply academy, slot and enrollment boundaries', async () => {
        const result = await request(app).get('/paca/schedules/701/attendance-state');
        expect(result.status).toBe(200);
        expect(result.body.students.map((row) => [row.student_id, row.attendance_status])).toEqual([[101, null], [105, null]]);
        const [[count]] = await mockPool.query('SELECT COUNT(*) AS count FROM attendance');
        expect(count.count).toBe(1);
        expect(result.body.schedule.attendance_taken).toBe(0);
    });
});
