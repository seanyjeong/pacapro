/**
 * 월 청구 금액 공통 함수(utils/monthlyBillAmounts) — 학원비 × 할인율 / 100 을 정확히 계산한 뒤 천원 절삭.
 * (a) 정수 할인율 0~100 × 학원비 1만~200만(1만 단위) 전 범위와 소수 할인율·전 단위 학원비에서 BigInt 로 만든 정확한 값과 같다.
 * (b) 매달 자동 청구·일괄 청구·학생별 청구·AI 연결 월회비 청구가 같은 학생에 같은 금액을 만든다.
 */
jest.mock('../../config/database', () => ({
    query: (...args) => global.__monthlyBillDb.query(...args),
    execute: (...args) => global.__monthlyBillDb.execute(...args),
    getConnection: (...args) => global.__monthlyBillDb.getConnection(...args),
}));
jest.mock('../../middleware/auth', () => ({
    verifyToken: (req, res, next) => { req.user = { academyId: 1, userId: 10, role: 'owner' }; next(); },
    checkPermission: () => (req, res, next) => next(),
    requireRole: () => (req, res, next) => next(),
}));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../services/seasonGraduationService', () => ({ graduateDueSeasonStudents: jest.fn().mockResolvedValue(0) }));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { monthlyBillAmounts } = require('../../utils/monthlyBillAmounts');
const { generateMonthlyPayments } = require('../../scheduler/paymentScheduler');
const maxEngineMonthlyPayment = require('../../services/maxEngineMonthlyPayment');

// 정확한 기대값: 원·할인율을 100배 정수(BigInt)로 바꿔 계산
const cents = value => BigInt(Math.round(value * 100));
function exact(tuition, rate, additional = 0, carryover = 0) {
    const discount = (cents(tuition) * cents(rate) / 1000000000n) * 1000n; // 양수라 BigInt 나눗셈 = 내림
    const total = cents(tuition) - discount * 100n + cents(additional) - cents(carryover);
    const floorDiv = (a, b) => (a >= 0n ? a / b : -((-a + b - 1n) / b));
    const final = floorDiv(total, 100000n) * 1000n;
    return { discount: Number(discount), final: Number(final > 0n ? final : 0n) };
}

describe('(a) 공통 함수 = 정확한 값', () => {
    test('정수 할인율 0~100 × 학원비 1만~200만(1만 단위) 전 범위', () => {
        const wrong = [];
        for (let rate = 0; rate <= 100; rate++) {
            for (let tuition = 10000; tuition <= 2000000; tuition += 10000) {
                const got = monthlyBillAmounts(tuition, rate);
                const want = exact(tuition, rate);
                if (got.discount !== want.discount || got.final !== want.final) wrong.push([tuition, rate, got, want]);
            }
        }
        expect(wrong).toEqual([]);
    });

    test('예전 식이 천원 틀리던 경우: 29%·100,000원 → 할인 29,000, 최종 71,000', () => {
        expect(Math.floor(100000 * (29 / 100) / 1000) * 1000).toBe(28000); // 예전 일괄·학생별 청구 식
        expect(monthlyBillAmounts(100000, 29)).toEqual({ discount: 29000, final: 71000 });
        expect(Math.floor(1000000 * 4.1 / 100 / 1000) * 1000).toBe(40000); // 예전 매달 자동 청구 식
        expect(monthlyBillAmounts(1000000, 4.1)).toEqual({ discount: 41000, final: 959000 });
    });

    test('소수 할인율(0.01~99.99)·전 단위 학원비·추가 금액·크레딧', () => {
        const rates = [0.01, 0.5, 2.25, 12.5, 14.5, 29, 33.33, 57, 66.67, 99.99];
        const tuitions = [10000, 99999.99, 100000, 333333, 333333.33, 350000.5, 1234567.89, 99999999.99];
        const extras = [[0, 0], [5000, 0], [0, 20000], [7500.5, 12300.25], [0, 99999999]];
        const wrong = [];
        for (const rate of rates) for (const tuition of tuitions) for (const [additional, carryover] of extras) {
            const got = monthlyBillAmounts(tuition, rate, additional, carryover);
            const want = exact(tuition, rate, additional, carryover);
            if (got.discount !== want.discount || got.final !== want.final) wrong.push([tuition, rate, additional, carryover, got, want]);
        }
        expect(wrong).toEqual([]);
    });

    test('DB 문자열 값("350000.00", "5.00")도 같다', () => {
        expect(monthlyBillAmounts('350000.00', '5.00', '0.00', 0)).toEqual({ discount: 17000, final: 333000 });
    });
});

// (b) 청구 만드는 네 경로 — DB 경계만 대역(기존 청구·크레딧·시즌 없음)
function billingDb(student) {
    const writes = [];
    const run = async (sql, params = []) => {
        if (/^\s*INSERT INTO student_payments/i.test(sql)) { writes.push(params); return [{ insertId: 1, affectedRows: 1 }]; }
        if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) return [{ affectedRows: 1 }];
        if (/AS allowed/i.test(sql)) return [[{ allowed: 1 }]];
        if (/FROM academies a\s+LEFT JOIN academy_settings/i.test(sql)) return [[{ academy_id: 1, default_due_day: 5 }]];
        if (/SELECT tuition_due_day FROM academies/i.test(sql)) return [[{ tuition_due_day: 5 }]];
        if (/FROM student_payments p\s+JOIN students/i.test(sql)) return [[{ id: 1 }]];
        if (/FROM students s\b/i.test(sql)) return [[{ ...student, tuition_due_day: 5 }]];
        return [[]];
    };
    const connection = { query: run, execute: run, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} };
    return { writes, query: run, execute: run, getConnection: async () => connection };
}

async function fourPaths(tuition, rate) {
    const student = { id: 1, name: '합성', status: 'active', monthly_tuition: tuition.toFixed(2), discount_rate: rate.toFixed(2),
        class_days: '[]', due_day: 5, payment_due_day: 5 };
    const app = express(); app.use(express.json());
    const router = express.Router();
    require('../../routes/payments/bulk')(router);
    require('../../routes/payments/bulk/monthlyForStudent')(router);
    app.use('/p', router);

    global.__monthlyBillDb = billingDb(student);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await generateMonthlyPayments();
    log.mockRestore();
    const [s] = global.__monthlyBillDb.writes; // student, academy, ym, base, discount, carryover, credit, final

    global.__monthlyBillDb = billingDb(student);
    expect((await request(app).post('/p/bulk-monthly').send({ year: 2026, month: 12 })).status).toBe(200);
    const [b] = global.__monthlyBillDb.writes; // student, academy, ym, base, discount, additional, carryover, credit, final

    global.__monthlyBillDb = billingDb(student);
    expect((await request(app).post('/p/generate-monthly-for-student').send({ student_id: 1, year: 2026, month: 12 })).status).toBe(201);
    const [m] = global.__monthlyBillDb.writes; // student, academy, ym, base, discount, additional, final

    const command = { operation: 'monthly_payment_create', changes: { student_id: 1, year_month: '2026-12' } };
    const { after } = maxEngineMonthlyPayment.display(command, { student, allowed: true, existing: [], credit: null });

    return {
        '매달 자동 청구': [s[3], s[4], s[7]],
        '일괄 청구': [b[3], b[4], b[8]],
        '학생별 청구': [m[3], m[4], m[6]],
        'AI 연결 월회비 청구': [after.base_amount, after.discount_amount, after.final_amount],
    };
}

describe('(b) 청구 만드는 경로가 같은 학생에 같은 금액', () => {
    test.each([
        [100000, 29], [200000, 14.5], [1000000, 4.1], [2000000, 0.35], [350000, 5], [333333, 33.33], [450000, 10], [1500000, 57], [350000, 0], [123456, 12.5],
    ])('학원비 %d원, 할인 %d%%', async (tuition, rate) => {
        const paths = await fourPaths(tuition, rate);
        const want = exact(tuition, rate);
        for (const [name, amounts] of Object.entries(paths)) {
            expect([name, ...amounts]).toEqual([name, tuition, want.discount, want.final]);
        }
    });
});
