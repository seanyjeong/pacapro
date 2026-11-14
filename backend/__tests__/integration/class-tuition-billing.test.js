/**
 * 반별 학원비 충돌 금지 — "반 학원비 적용"은 학생에 저장된 학원비(monthly_tuition)만 바꾸고,
 * 월 청구·일할계산은 원래 코드 그대로 그 값으로 계산한다.
 *
 * 1) 실제 SQL(메모리 DB)로 반 학원비 미리보기 → 적용
 * 2) 적용 전·후 학생 행을 실제 청구 코드에 넣는다(DB 경계만 대역):
 *    매달 자동 청구(scheduler/paymentScheduler), 일괄 청구(POST /payments/bulk-monthly),
 *    학생별 청구(POST /payments/generate-monthly-for-student), 첫 달 일할 재계산(POST /students/:id/recalculate-first-payment),
 *    휴원 복귀 일할(services/resumePaymentService)
 * 3) 반 표가 있는 반 학생 = 새 금액 기준, 반 표가 없는 반·반 없는 학생 = 적용 전과 한 글자도 같은 청구
 */
jest.mock('../../config/database', () => ({
    query: (...args) => global.__classTuitionDb.query(...args),
    execute: (...args) => global.__classTuitionDb.execute(...args),
    getConnection: (...args) => global.__classTuitionDb.getConnection(...args),
}));
jest.mock('../../middleware/auth', () => ({
    verifyToken: (req, res, next) => { req.user = { academyId: 1, userId: 10, role: 'owner' }; next(); },
    checkPermission: () => (req, res, next) => next(),
    requireRole: () => (req, res, next) => next(),
}));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../services/seasonGraduationService', () => ({ graduateDueSeasonStudents: jest.fn().mockResolvedValue(0) }));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const request = require('supertest');
const { generateMonthlyPayments } = require('../../scheduler/paymentScheduler');
const { calculateResumePayment } = require('../../services/resumePaymentService');

// --- 1) 반 학원비 적용: 실제 SQL ---
function memoryDb() {
    const database = new DatabaseSync(':memory:');
    database.exec(`
        CREATE TABLE academy_settings (id INTEGER PRIMARY KEY, academy_id INTEGER, settings TEXT);
        INSERT INTO academy_settings (academy_id, settings) VALUES (1, '{"exam_tuition":{"weekly_3":300000},"adult_tuition":{}}');
        CREATE TABLE branches (id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT, sort_order INTEGER DEFAULT 0, status TEXT DEFAULT 'active');
        INSERT INTO branches (id, academy_id, name) VALUES (1, 1, '수성');
        CREATE TABLE classes (
            id INTEGER PRIMARY KEY, academy_id INTEGER, branch_id INTEGER, class_name TEXT, default_time_slot TEXT,
            class_days TEXT, instructor_id INTEGER, sort_order INTEGER DEFAULT 0, status TEXT DEFAULT 'active', tuition_by_weekly TEXT
        );
        INSERT INTO classes (id, academy_id, branch_id, class_name, tuition_by_weekly) VALUES
            (8, 1, 1, '정시반', '{"weekly_3":450000}'), (9, 1, 1, '선행반', NULL);
        CREATE TABLE students (
            id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT, status TEXT, student_type TEXT, weekly_count INTEGER,
            monthly_tuition REAL, discount_rate REAL, final_monthly_tuition REAL, branch_id INTEGER, class_id INTEGER,
            class_days TEXT, time_slot TEXT, payment_due_day INTEGER, enrollment_date TEXT, rest_start_date TEXT, deleted_at TEXT
        );
        INSERT INTO students (id, academy_id, name, status, student_type, weekly_count, monthly_tuition, discount_rate, branch_id, class_id,
                              class_days, time_slot, enrollment_date, rest_start_date) VALUES
            (1, 1, '정시반 학생', 'active', 'exam', 3, 300000, 10, 1, 8, '[1,3,5]', 'evening', '2026-11-18', '2026-12-01'),
            (2, 1, '선행반 학생', 'active', 'exam', 3, 300000, 10, 1, 9, '[1,3,5]', 'evening', '2026-11-18', '2026-12-01'),
            (3, 1, '반 없는 학생', 'active', 'exam', 3, 300000, 0, NULL, NULL, '[1,3,5]', 'evening', '2026-11-18', '2026-12-01');
    `);
    const query = async (sql, params = []) => {
        const statement = database.prepare(sql);
        if (/^\s*SELECT/i.test(sql)) return [statement.all(...params)];
        const result = statement.run(...params);
        return [{ insertId: Number(result.lastInsertRowid), affectedRows: Number(result.changes) }];
    };
    const connection = {
        query, execute: query, release() {},
        async beginTransaction() { database.exec('BEGIN'); }, async commit() { database.exec('COMMIT'); }, async rollback() { database.exec('ROLLBACK'); }
    };
    return { database, query, execute: query, getConnection: async () => connection };
}

// --- 2) 청구 코드의 DB 경계: 학생 행만 돌려주고 청구서 쓰기를 받아 적는다(기존 청구·크레딧·시즌 없음) ---
function billingDb(students) {
    const writes = [];
    const run = async (sql, params = []) => {
        if (/^\s*(INSERT INTO|UPDATE) student_payments/i.test(sql)) {
            writes.push(params);
            return [{ insertId: writes.length, affectedRows: 1 }];
        }
        if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) return [{ affectedRows: 0 }];
        if (/AS allowed/i.test(sql)) return [[{ allowed: 1 }]];
        if (/FROM academies a\s+LEFT JOIN academy_settings/i.test(sql)) return [[{ academy_id: 1, default_due_day: 5 }]];
        if (/SELECT tuition_due_day FROM academies/i.test(sql)) return [[{ tuition_due_day: 5 }]];
        if (/is_prorated = 1 OR description LIKE/i.test(sql)) return [[{ id: 77, payment_status: 'pending', additional_amount: 0, carryover_amount: 0 }]];
        if (/FROM student_payments p\s+JOIN students/i.test(sql)) return [[{ id: params[0] }]];
        if (/FROM students(\s+s)?\s+(JOIN academies ac ON s\.academy_id = ac\.id[\s\S]*)?WHERE (s\.)?id = \?/i.test(sql)) {
            return [students.filter(student => student.id === Number(params[0])).map(student => ({ ...student, tuition_due_day: 5 }))];
        }
        if (/FROM students s\b/i.test(sql)) {
            return [students.filter(student => student.status === 'active' && (!/monthly_tuition > 0/.test(sql) || student.monthly_tuition > 0))];
        }
        return [[]];
    };
    const connection = { query: run, execute: run, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} };
    return { writes, query: run, execute: run, getConnection: async () => connection };
}

function paymentsApp() {
    const app = express();
    app.use(express.json());
    const payments = express.Router();
    require('../../routes/payments/bulk')(payments);
    require('../../routes/payments/bulk/monthlyForStudent')(payments);
    app.use('/paca/payments', payments);
    const students = express.Router();
    require('../../routes/students/firstPayment')(students);
    app.use('/paca/students', students);
    return app;
}

// 학생 행으로 다섯 곳의 청구·일할 금액을 뽑는다
async function billAll(students) {
    const result = {};
    // 매달 자동 청구 (12월 1일 00:01 KST)
    global.__classTuitionDb = billingDb(students);
    jest.useFakeTimers({ now: new Date('2026-12-01T00:01:00+09:00') });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
        await generateMonthlyPayments();
    } finally {
        jest.useRealTimers();
        log.mockRestore();
    }
    // INSERT 순서: student_id, academy_id, year_month, base, discount, carryover, rest_credit_id, final, ...
    result.scheduler = global.__classTuitionDb.writes.map(p => ({ student: p[0], month: p[2], base: p[3], discount: p[4], final: p[7] }));

    const app = paymentsApp();
    // 일괄 청구 — 응답은 기존 동작대로 5xx(due_date 참조) 지만 청구서는 이미 쓰여 있다
    global.__classTuitionDb = billingDb(students);
    await request(app).post('/paca/payments/bulk-monthly').send({ year: 2026, month: 12 });
    // INSERT 순서: student_id, academy_id, year_month, base, discount, additional, carryover, rest_credit_id, final, ...
    result.bulk = global.__classTuitionDb.writes.map(p => ({ student: p[0], month: p[2], base: p[3], discount: p[4], final: p[8] }));

    result.perStudent = [];
    result.firstMonth = [];
    for (const student of students) {
        global.__classTuitionDb = billingDb(students);
        await request(app).post('/paca/payments/generate-monthly-for-student').send({ student_id: student.id, year: 2026, month: 12 });
        const [p] = global.__classTuitionDb.writes;
        result.perStudent.push({ student: p[0], base: p[3], discount: p[4], final: p[6] });

        global.__classTuitionDb = billingDb(students);
        const recalculated = await request(app).post(`/paca/students/${student.id}/recalculate-first-payment`).send({});
        const { base_amount, discount_amount, final_amount } = recalculated.body.payment;
        result.firstMonth.push({ student: student.id, base: base_amount, discount: discount_amount, final: final_amount });
    }
    // 휴원 복귀 일할 (12월 16일 복귀, 월·수·금)
    result.resume = students.map(student => {
        const plan = calculateResumePayment(student, '2026-12-16', [1, 3, 5]);
        return { student: student.id, base: plan.baseAmount, discount: plan.discountAmount, final: plan.finalAmount };
    });
    return result;
}

const only = (rows, id) => rows.filter(row => row.student === id);
const withoutStudent = (bills, id) => Object.fromEntries(Object.entries(bills).map(([key, rows]) => [key, rows.filter(row => row.student !== id)]));

test('반 학원비 적용 뒤 반 표가 있는 반 학생은 새 금액으로, 나머지는 적용 전과 같은 금액으로 청구된다', async () => {
    const memory = memoryDb();
    const readStudents = () => memory.database.prepare('SELECT * FROM students ORDER BY id').all();

    const before = await billAll(readStudents());

    // 반 학원비 적용 (미리보기 → 확인 → 적용)
    global.__classTuitionDb = memory;
    const branches = express();
    branches.use(express.json());
    branches.use('/paca/branches', require('../../routes/branches'));
    const preview = await request(branches).get('/paca/branches/classes/8/tuition-preview');
    expect(preview.body.students.map(s => [s.student_id, s.current_tuition, s.new_tuition, s.new_final_tuition]))
        .toEqual([[1, 300000, 450000, 405000]]);
    const applied = await request(branches).post('/paca/branches/classes/8/apply-tuition')
        .send({ changes: preview.body.students.filter(s => s.changed).map(s => ({ student_id: s.student_id, new_tuition: s.new_tuition })) });
    expect(applied.status).toBe(200);
    const students = readStudents();
    expect(students.map(s => [s.id, s.monthly_tuition, s.discount_rate])).toEqual([[1, 450000, 10], [2, 300000, 10], [3, 300000, 0]]);

    const after = await billAll(students);

    // 반 표가 없는 반·반 없는 학생: 적용 전과 같은 청구
    expect(withoutStudent(after, 1)).toEqual(withoutStudent(before, 1));
    expect(only(after.scheduler, 2)).toEqual([{ student: 2, month: '2026-12', base: 300000, discount: 30000, final: 270000 }]);
    expect(only(after.scheduler, 3)).toEqual([{ student: 3, month: '2026-12', base: 300000, discount: 0, final: 300000 }]);

    // 반 표가 있는 반 학생: 새 학원비(할인율 10% 그대로)
    const monthly = { base: 450000, discount: 45000, final: 405000 };
    expect(only(after.scheduler, 1)).toEqual([{ student: 1, month: '2026-12', ...monthly }]);
    expect(only(after.bulk, 1)).toEqual([{ student: 1, month: '2026-12', ...monthly }]);
    expect(only(after.perStudent, 1)).toEqual([{ student: 1, ...monthly }]);
    // 11월 18일 등록, 월·수·금 11월 수업 13회 중 6회
    expect(only(after.firstMonth, 1)).toEqual([{ student: 1, base: 207000, discount: 20000, final: 187000 }]);
    expect(only(before.firstMonth, 1)).toEqual([{ student: 1, base: 138000, discount: 13000, final: 125000 }]);

    // 일할 계산은 처음부터 450000 으로 넣은 학생과 같은 금액이다(계산식은 그대로, 들어간 값만 다름)
    const typedIn = await billAll([{ ...students[0], monthly_tuition: 450000 }]);
    expect(only(after.resume, 1)).toEqual(typedIn.resume);
    expect(only(after.firstMonth, 1)).toEqual(typedIn.firstMonth);
    expect(only(after.resume, 1)[0].base).toBeGreaterThan(only(before.resume, 1)[0].base);
});
