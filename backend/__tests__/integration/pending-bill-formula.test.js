/**
 * 학원비가 바뀔 때 고치는 미납 월 청구 금액 = 같은 학생으로 월 자동 청구를 새로 만들었을 때 금액.
 * 기대값은 실제 월 자동 청구 코드(scheduler/paymentScheduler, POST /payments/bulk-monthly)에 같은 입력을 넣어 얻는다.
 * 네 경로(학생 수정·수업일 변경·반 학원비 적용·반 이동)를 실제 SQL(메모리 DB)로 돌려 비교한다.
 */
// 48가지 × 4 경로를 실제 코드로 돌려, 전체 시험을 함께 돌릴 때 첫 준비가 기본 5초를 넘을 수 있다
jest.setTimeout(30000);
jest.mock('../../config/database', () => ({
    query: (...args) => global.__billFormulaDb.query(...args),
    execute: (...args) => global.__billFormulaDb.execute(...args),
    getConnection: (...args) => global.__billFormulaDb.getConnection(...args),
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
const { updatePendingPayments } = require('../../routes/students/crud/update/paymentEffects');
const { truncateToThousands } = require('../../utils/seasonCalculator');

const koreaMonth = offset => {
    const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
};
const THIS_MONTH = koreaMonth(0);
const LAST_MONTH = koreaMonth(-1);
const NEXT_MONTH = koreaMonth(1);

// --- 기대값: 실제 월 자동 청구 코드 (DB 경계만 대역) ---
function autoBillingDb(student, carryover) {
    const inserts = [];
    const run = async (sql, params = []) => {
        if (/^\s*INSERT INTO student_payments/i.test(sql)) { inserts.push(params); return [{ insertId: 1, affectedRows: 1 }]; }
        if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) return [{ affectedRows: 1 }];
        if (/FROM rest_credits/i.test(sql)) {
            return [carryover > 0 ? [{ id: 1, remaining_amount: carryover, credit_type: 'carryover' }] : []];
        }
        if (/FROM academies a\s+LEFT JOIN academy_settings/i.test(sql)) return [[{ academy_id: 1, default_due_day: 5 }]];
        if (/SELECT tuition_due_day FROM academies/i.test(sql)) return [[{ tuition_due_day: 5 }]];
        if (/FROM students s\b/i.test(sql)) return [[student]];
        return [[]];
    };
    const connection = { query: run, execute: run, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} };
    return { inserts, query: run, execute: run, getConnection: async () => connection };
}

async function autoBills(base, rate, carryover) {
    const student = { id: 1, name: '합성', monthly_tuition: base.toFixed(2), discount_rate: rate.toFixed(2), class_days: '[]', due_day: 5 };
    global.__billFormulaDb = autoBillingDb(student, carryover);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await generateMonthlyPayments();
    log.mockRestore();
    const [s] = global.__billFormulaDb.inserts; // student, academy, ym, base, discount, carryover, credit, final
    global.__billFormulaDb = autoBillingDb(student, carryover);
    const app = express(); app.use(express.json());
    const router = express.Router(); require('../../routes/payments/bulk')(router); app.use('/p', router);
    await request(app).post('/p/bulk-monthly').send({ year: 2026, month: 12 });
    const [b] = global.__billFormulaDb.inserts; // student, academy, ym, base, discount, additional, carryover, credit, final
    return {
        scheduler: { base: s[3], discount: s[4], final: s[7] },
        bulk: { base: b[3], discount: b[4], final: b[8] },
    };
}

// --- 네 경로: 실제 SQL ---
function memoryDb({ base, rate, additional, carryover }) {
    const database = new DatabaseSync(':memory:');
    database.function('GREATEST', (a, b) => Math.max(a, b));
    database.function('NOW', () => 'now');
    database.exec(`
        CREATE TABLE academy_settings (id INTEGER PRIMARY KEY, academy_id INTEGER, settings TEXT);
        CREATE TABLE branches (id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT, sort_order INTEGER DEFAULT 0, status TEXT DEFAULT 'active');
        INSERT INTO branches (id, academy_id, name) VALUES (1, 1, '수성');
        CREATE TABLE classes (
            id INTEGER PRIMARY KEY, academy_id INTEGER, branch_id INTEGER, class_name TEXT, default_time_slot TEXT, class_days TEXT,
            instructor_id INTEGER, sort_order INTEGER DEFAULT 0, status TEXT DEFAULT 'active', tuition_by_weekly TEXT, tuition_by_weekly_before TEXT
        );
        CREATE TABLE students (
            id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT, status TEXT, student_type TEXT, weekly_count INTEGER,
            monthly_tuition REAL, discount_rate REAL, final_monthly_tuition REAL, branch_id INTEGER, class_id INTEGER,
            is_trial INTEGER DEFAULT 0, class_days TEXT, time_slot TEXT, class_days_next TEXT, class_days_effective_from TEXT,
            updated_at TEXT, deleted_at TEXT
        );
        CREATE TABLE student_payments (
            id INTEGER PRIMARY KEY, academy_id INTEGER, student_id INTEGER, branch_id INTEGER, year_month TEXT, payment_type TEXT,
            payment_status TEXT, is_prorated INTEGER DEFAULT 0, description TEXT, base_amount REAL, discount_amount REAL,
            additional_amount REAL DEFAULT 0, carryover_amount REAL DEFAULT 0, final_amount REAL, updated_at TEXT
        );
    `);
    database.prepare('INSERT INTO academy_settings (academy_id, settings) VALUES (1, ?)')
        .run(JSON.stringify({ exam_tuition: { weekly_2: base, weekly_3: 300000 } }));
    database.prepare(`INSERT INTO classes (id, academy_id, branch_id, class_name, tuition_by_weekly) VALUES
        (8, 1, 1, '반 표 있는 반', ?), (9, 1, 1, '기본표 반', NULL)`).run(JSON.stringify({ weekly_3: base }));
    database.prepare(`INSERT INTO students (id, academy_id, name, status, student_type, weekly_count, monthly_tuition, discount_rate,
        branch_id, class_id, class_days, time_slot) VALUES (1, 1, '합성', 'active', 'exam', 3, 300000, ?, 1, 9, '[1,3,5]', 'evening')`).run(rate);
    const bill = database.prepare(`INSERT INTO student_payments (id, academy_id, student_id, year_month, payment_type, payment_status,
        description, base_amount, discount_amount, additional_amount, carryover_amount, final_amount, updated_at)
        VALUES (?, 1, 1, ?, 'monthly', 'pending', '월 학원비', 300000, 0, ?, ?, ?, 'kept')`);
    bill.run(1, THIS_MONTH, additional, carryover, 300000 + additional - carryover);
    bill.run(2, LAST_MONTH, additional, carryover, 300000 + additional - carryover);
    // 비시즌 종강 일할 청구(services/nonSeasonProratedBilling 이 만드는 모양: is_prorated 없음) — 월 정액으로 덮으면 안 된다
    database.prepare(`INSERT INTO student_payments (id, academy_id, student_id, year_month, payment_type, payment_status,
        description, base_amount, discount_amount, additional_amount, carryover_amount, final_amount, updated_at)
        VALUES (3, 1, 1, ?, 'monthly', 'pending', ?, 120000, 0, 0, 0, 120000, 'kept')`)
        .run(NEXT_MONTH, `${Number(NEXT_MONTH.slice(5))}월 학원비 (비시즌 종강 일할)`);
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

function routesApp() {
    const app = express(); app.use(express.json());
    const students = express.Router(); require('../../routes/students/classDays')(students); app.use('/paca/students', students);
    app.use('/paca/branches', require('../../routes/branches'));
    return app;
}
const confirm = changes => changes.map(({ student_id, current_tuition, new_tuition }) => ({ student_id, current_tuition, new_tuition }));

const paths = {
    async '학생 수정'({ base, rate }) {
        await updatePendingPayments({ pool: global.__billFormulaDb, studentId: 1, academyId: 1, monthlyTuition: base, discountRate: rate,
            oldStatus: 'active', oldStudent: { monthly_tuition: '300000.00', discount_rate: rate },
            updatedStudent: { status: 'active', monthly_tuition: base, discount_rate: rate } });
    },
    async '수업일 변경'() {
        // 학원 표 주2회 = base
        expect((await request(routesApp()).put('/paca/students/1/class-days').send({ class_days: [1, 3] })).status).toBe(200);
    },
    async '반 학원비 적용'() {
        global.__billFormulaDb.database.exec('UPDATE students SET class_id = 8');
        const preview = (await request(routesApp()).get('/paca/branches/classes/8/tuition-preview')).body.students;
        const applied = await request(routesApp()).post('/paca/branches/classes/8/apply-tuition').send({ changes: confirm(preview) });
        expect(applied.status).toBe(200);
        return preview[0].pending_bills;
    },
    async '반 이동'() {
        const { changes } = (await request(routesApp()).post('/paca/branches/students/tuition-preview').send({ student_ids: [1], class_id: 8 })).body;
        const moved = await request(routesApp()).put('/paca/branches/students').send({ student_ids: [1], class_id: 8, tuition_changes: confirm(changes) });
        expect(moved.status).toBe(200);
        return changes[0].pending_bills;
    },
};

const cases = [];
for (const rate of [0, 5, 10, 33]) {
    for (const base of [350000, 333333, 450000]) {
        for (const [additional, carryover] of [[0, 0], [5000, 0], [0, 20000], [7500, 12300]]) cases.push({ rate, base, additional, carryover });
    }
}

describe.each(cases)('할인 $rate%, 학원비 $base, 추가 $additional, 크레딧 $carryover', (input) => {
    let expected;
    beforeAll(async () => {
        const auto = await autoBills(input.base, input.rate, input.carryover);
        // 월 자동 청구 두 곳(매달 자동·일괄)은 같은 금액을 만든다
        expect(auto.bulk).toEqual(auto.scheduler);
        // 자동 청구는 추가 금액이 늘 0 이라, 추가 금액은 일괄 청구 식(학원비 − 할인액 + 추가 − 크레딧 → 천원 절삭)에 넣는다
        expected = {
            base_amount: input.base,
            discount_amount: auto.scheduler.discount,
            final_amount: input.additional
                ? Math.max(truncateToThousands(input.base - auto.scheduler.discount + input.additional - input.carryover), 0)
                : auto.scheduler.final,
        };
    });

    test.each(Object.keys(paths))('%s: 고친 미납 청구 = 월 자동 청구 금액, 지난 달·비시즌 종강 일할 청구는 그대로', async (name) => {
        global.__billFormulaDb = memoryDb(input);
        const previewBills = await paths[name](input);
        const rows = global.__billFormulaDb.database.prepare(
            'SELECT id, base_amount, discount_amount, final_amount FROM student_payments ORDER BY id').all();
        expect({ ...rows[0] }).toEqual({ id: 1, ...expected });
        expect({ ...rows[1] }).toEqual({ id: 2, base_amount: 300000, discount_amount: 0, final_amount: 300000 + input.additional - input.carryover });
        expect({ ...rows[2] }).toEqual({ id: 3, base_amount: 120000, discount_amount: 0, final_amount: 120000 });
        // 미리보기가 보여 준 새 청구 금액도 같다
        if (previewBills) expect(previewBills.map(bill => bill.new_amount)).toEqual([expected.final_amount]);
        // 할인 0%·천원 단위 금액이면 예전 식(학원비 + 추가 − 크레딧)과 같다
        if (input.rate === 0 && input.base % 1000 === 0 && input.additional % 1000 === 0 && input.carryover % 1000 === 0) {
            expect(expected.final_amount).toBe(input.base + input.additional - input.carryover);
        }
    });
});
