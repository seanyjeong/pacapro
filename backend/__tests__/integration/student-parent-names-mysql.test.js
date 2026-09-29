process.env.DATA_ENCRYPTION_KEY = 'isolated-parent-name-mysql-test-key';
const mysql = require('mysql2/promise');
const mockPool = process.env.PACA_PARENT_NAMES_MYSQL_SOCKET ? mysql.createPool({
    socketPath: process.env.PACA_PARENT_NAMES_MYSQL_SOCKET,
    user: 'root', database: 'paca_parent_names_fixture', dateStrings: true, connectionLimit: 2,
}) : null;
jest.mock('../../config/database', () => mockPool);
jest.mock('../../middleware/auth', () => ({
    verifyToken: (req, res, next) => {
        if (!req.headers['x-fixture-academy']) return res.sendStatus(401);
        req.user = { academyId: Number(req.headers['x-fixture-academy']), userId: 1, id: 1, role: 'owner' };
        next();
    },
    checkPermission: () => (req, res, next) => req.headers['x-fixture-readonly'] ? res.sendStatus(403) : next(),
    requireRole: () => (req, res, next) => next(),
}));
jest.mock('../../utils/auditLogger', () => ({ logAudit: jest.fn(), getAuditInfoFromReq: () => ({}) }));
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { createParentNamesFixture } = require('./student-parent-names-fixture');
const { logAudit } = require('../../utils/auditLogger');
const suite = mockPool ? describe : describe.skip;

suite('student parent contacts: real MySQL migration and HTTP contracts', () => {
    let app;
    let firstId;
    const api = (method, url, academy = 1) => request(app)[method](url).set('x-fixture-academy', String(academy));
    const migration = ['20260914_add_student_parent_names.mysql', '20260929_add_student_parent_phones.mysql']
        .map(file => fs.readFileSync(path.join(__dirname, '../../migrations', file), 'utf8')).join('\n');
    const migrate = async () => {
        const connection = await mockPool.getConnection();
        try {
            for (const statement of migration.split(';').map(s => s.trim()).filter(Boolean)) await connection.query(statement);
        } finally { connection.release(); }
    };
    beforeAll(async () => {
        await createParentNamesFixture(mockPool);
        app = express(); app.use(express.json());
        const students = express.Router();
        for (const route of ['list', 'detail', 'create', 'update']) require(`../../routes/students/crud/${route}`)(students);
        app.use('/students', students);
        const payments = express.Router();
        require('../../routes/payments/list')(payments);
        require('../../routes/payments/crud')(payments);
        app.use('/payments', payments);
    });
    afterAll(async () => { if (mockPool) await mockPool.end(); });

    test('additive migration is repeatable and preserves legacy data', async () => {
        const [[before]] = await mockPool.query('SELECT * FROM students WHERE id=99');
        await migrate(); await migrate();
        const [[after]] = await mockPool.query('SELECT * FROM students WHERE id=99');
        expect(after).toEqual({ ...before, father_name: null, mother_name: null, father_phone: null, mother_phone: null });
        const [columns] = await mockPool.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME='students' AND COLUMN_NAME IN ('father_phone','mother_phone')`);
        expect(columns).toHaveLength(2);
        for (const column of columns) {
            expect(column).toMatchObject({ COLUMN_TYPE: 'varchar(512)', IS_NULLABLE: 'YES', COLUMN_DEFAULT: null });
        }
    });

    test('create encrypts both names; list and detail decrypt them', async () => {
        for (const [name, academy] of [['김첫째', 1], ['김둘째', 1], ['다른학원학생', 2]]) {
            const result = await api('post', '/students', academy).send({ name, phone: '010-1234-5678',
                class_days: [], monthly_tuition: 0, father_name: ' 김아버지 ', mother_name: '박어머니' });
            expect(result.status).toBe(201);
            expect(result.body.student.father_name).toBe('김아버지');
            if (!firstId) firstId = result.body.student.id;
        }
        const [[stored]] = await mockPool.query('SELECT * FROM students WHERE id=?', [firstId]);
        expect(stored.father_name).toMatch(/^ENC:/);
        expect(stored.mother_name).toMatch(/^ENC:/);
        const detail = await api('get', `/students/${firstId}`);
        expect(detail.status).toBe(200);
        expect(detail.body.student.mother_name).toBe('박어머니');
        const list = await api('get', '/students').query({ search: ' 김 아버지 ' });
        expect(list.status).toBe(200);
        expect(list.body.students.map(s => s.name).sort()).toEqual(['김둘째', '김첫째']);
        expect((await api('get', '/students').query({ search: '박어머니' })).body.students).toHaveLength(2);
    });

    test('payment reads include decrypted parent identity without changing balances', async () => {
        await mockPool.query(`INSERT INTO student_payments
            (id,academy_id,student_id,\`year_month\`,payment_type,base_amount,discount_amount,additional_amount,
            final_amount,paid_amount,due_date,payment_status) VALUES (501,1,?,'2026-09','monthly',350000,0,0,350000,100000,'2026-09-01','partial')`, [firstId]);
        for (const url of ['/payments', '/payments/unpaid', '/payments/501']) {
            const result = await api('get', url);
            expect(result.status).toBe(200);
            const payment = result.body.payment || result.body.payments[0];
            expect(payment.father_name).toBe('김아버지');
            expect(payment.mother_name).toBe('박어머니');
            expect(Number(payment.paid_amount)).toBe(100000);
        }
        expect((await api('get', '/payments', 2)).body.payments).toEqual([]);
        expect((await api('get', '/payments/501', 2)).status).toBe(404);
    });

    test('partial updates preserve omitted parents; blanks and null clear only supplied parent', async () => {
        const [[paymentBefore]] = await mockPool.query('SELECT * FROM student_payments WHERE id=501');
        let result = await api('put', `/students/${firstId}`).send({ memo: '연락 예정' });
        expect(result.body).toMatchObject({ message: 'Student updated successfully' });
        expect(result.status).toBe(200);
        expect(result.body.student.father_name).toBe('김아버지');
        result = await api('put', `/students/${firstId}`).send({ father_name: ' 김새성함 ' });
        expect(result.status).toBe(200);
        expect(result.body.student.father_name).toBe('김새성함');
        expect(result.body.student.mother_name).toBe('박어머니');
        const audit = JSON.stringify(logAudit.mock.calls);
        expect(audit).not.toContain('김새성함');
        expect(audit).not.toContain('김아버지');
        result = await api('put', `/students/${firstId}`).send({ father_name: ' ' });
        expect(result.status).toBe(200);
        expect(result.body.student.father_name).toBeNull();
        expect(result.body.student.mother_name).toBe('박어머니');
        result = await api('put', `/students/${firstId}`).send({ mother_name: null });
        expect(result.body.student.mother_name).toBeNull();
        const [[paymentAfter]] = await mockPool.query('SELECT * FROM student_payments WHERE id=501');
        expect(paymentAfter).toEqual(paymentBefore);
    });

    test('invalid input, other academy and denied writes do not mutate the student', async () => {
        const [[before]] = await mockPool.query('SELECT * FROM students WHERE id=?', [firstId]);
        for (const father_name of [123, '가'.repeat(101), 'ENC:forged']) {
            expect((await api('put', `/students/${firstId}`).send({ father_name })).status).toBe(400);
        }
        expect((await api('put', `/students/${firstId}`, 2).send({ father_name: '타학원' })).status).toBe(404);
        expect((await api('get', `/students/${firstId}`, 2)).status).toBe(404);
        expect((await request(app).get('/students')).status).toBe(401);
        expect((await api('put', `/students/${firstId}`).set('x-fixture-readonly', 'true').send({ father_name: '금지' })).status).toBe(403);
        const [[after]] = await mockPool.query('SELECT * FROM students WHERE id=?', [firstId]);
        expect(after).toEqual(before);
    });

    test('two parent phones survive create, list, detail, partial edits and individual clearing', async () => {
        const result = await api('post', '/students').send({ name: '연락처검증학생', phone: '010-2222-5555',
            class_days: [], monthly_tuition: 0, parent_phone: '010-7777-8888',
            father_phone: '01011112222', mother_phone: '010-3333-4444' });
        expect(result.status).toBe(201);
        const id = result.body.student.id;
        const [[stored]] = await mockPool.query('SELECT * FROM students WHERE id=?', [id]);
        expect(stored.father_phone).toMatch(/^ENC:/);
        expect(stored.mother_phone).toMatch(/^ENC:/);
        for (const student of [result.body.student, (await api('get', `/students/${id}`)).body.student,
            (await api('get', '/students')).body.students.find(s => s.id === id)]) {
            expect(student.father_phone).toBe('010-1111-2222');
            expect(student.mother_phone).toBe('010-3333-4444');
            expect(student.parent_phone).toBe('010-7777-8888');
        }
        expect((await api('put', `/students/${id}`).send({ memo: '번호 보존' })).status).toBe(200);
        const [[unchanged]] = await mockPool.query('SELECT father_phone,mother_phone FROM students WHERE id=?', [id]);
        expect(unchanged).toEqual({ father_phone: stored.father_phone, mother_phone: stored.mother_phone });
        let update = await api('put', `/students/${id}`).send({ father_phone: '010-9999-0000' });
        expect(update.status).toBe(200);
        expect(update.body.student.father_phone).toBe('010-9999-0000');
        expect(update.body.student.mother_phone).toBe('010-3333-4444');
        expect(update.body.student.parent_phone).toBe('010-7777-8888');
        update = await api('put', `/students/${id}`).send({ parent_phone: '010-3333-4444' });
        expect(update.status).toBe(200);
        expect(update.body.student.parent_phone).toBe('010-3333-4444');
        expect(update.body.student.father_phone).toBe('010-9999-0000');
        const audit = JSON.stringify(logAudit.mock.calls);
        for (const phone of ['010-1111-2222', '010-9999-0000', '010-3333-4444', '010-7777-8888']) expect(audit).not.toContain(phone);
        update = await api('put', `/students/${id}`).send({ father_phone: '' });
        expect(update.body.student.father_phone).toBeNull();
        expect(update.body.student.mother_phone).toBe('010-3333-4444');
        update = await api('put', `/students/${id}`).send({ mother_phone: null });
        expect(update.body.student.mother_phone).toBeNull();
        const legacy = await api('get', '/students/99');
        expect(legacy.body.student.father_phone).toBeNull();
        expect(legacy.body.student.mother_phone).toBeNull();
    });

    test('invalid phones, academy scope and write permissions prevent contact mutations', async () => {
        const [[before]] = await mockPool.query('SELECT * FROM students WHERE id=?', [firstId]);
        for (const mother_phone of [123, '010-123', 'ENC:forged']) {
            expect((await api('put', `/students/${firstId}`).send({ mother_phone })).status).toBe(400);
            expect((await api('post', '/students').send({ name: '잘못된번호', phone: '010-2222-6666', mother_phone })).status).toBe(400);
        }
        expect((await api('put', `/students/${firstId}`, 2).send({ father_phone: '010-8888-0000' })).status).toBe(404);
        expect((await api('put', `/students/${firstId}`).set('x-fixture-readonly', 'true')
            .send({ father_phone: '010-8888-0000' })).status).toBe(403);
        const [[after]] = await mockPool.query('SELECT * FROM students WHERE id=?', [firstId]);
        expect(after).toEqual(before);
    });
});
