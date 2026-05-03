/**
 * routes/payments/bulk.js 테스트 (Phase 3 #6).
 *
 * 회귀 보호 범위:
 *   - POST /paca/payments/bulk-monthly                  → { message, created, updated, skipped, withNonSeasonProrated, withCarryover, year, month, due_date }
 *     ⚠️ 원본 동작 보존 (ADR-013 / lesson #227): students.length > 0 일 때 due_date ReferenceError → 5xx
 *   - POST /paca/payments/generate-prorated             → { message, payment, proration } (201)
 *   - POST /paca/payments/generate-monthly-for-student  → { message, payment, nonSeasonProrated } (201)
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003)
 *   - 응답 표면 보존 (ADR-013)
 *   - lesson #206: 거대 endpoint 정상 케이스 = pool.execute.mockResolvedValue([[]]) default + 핵심 SQL 만 검증
 */

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 5, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => v),
}));

jest.mock('../../../utils/seasonCalculator', () => ({
    truncateToThousands: jest.fn((v) => Math.floor(v / 1000) * 1000),
    calculateProRatedFee: jest.fn(() => ({
        proRatedFee: 50000,
        classCountUntilEnd: 4,
        totalMonthlyClasses: 8,
        calculationDetails: { formula: '100000 × (4/8) = 50000' },
    })),
    parseWeeklyDays: jest.fn(() => [1, 3, 5]),
}));

jest.mock('../../../utils/dueDateCalculator', () => ({
    calculateDueDate: jest.fn(() => '2026-05-05'),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/payments/bulk')(router);
    app.use('/paca/payments', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
});

describe('POST /paca/payments/bulk-monthly', () => {
    test('400: 필수 누락', async () => {
        const res = await request(makeApp()).post('/paca/payments/bulk-monthly').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('필수 항목');
    });

    test('200: 활성 학생 0명 → early return (due_date 응답 X)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ tuition_due_day: 5 }]]) // academy settings
            .mockResolvedValueOnce([[]]);                       // students = 0
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('활성 상태인 학생이 없습니다.');
        expect(res.body.created).toBe(0);
        expect(res.body.updated).toBe(0);
        expect(res.body.due_date).toBeUndefined();
    });

    test('⚠️ 원본 동작 보존 (lesson #227): 학생 존재 시 due_date ReferenceError → 5xx', async () => {
        // 원본 (line 848) 의 due_date 가 for 블록 안 const 라 응답 객체에서 ReferenceError.
        // ADR-013 응답 표면 보존: 동일 broken 동작 1:1 보존.
        pool.execute
            .mockResolvedValueOnce([[{ tuition_due_day: 5 }]])
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 10, class_days: '[1,3]', payment_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[]]) // pendingCredits
            .mockResolvedValueOnce([[]]) // existingPayment
            .mockResolvedValueOnce([{ insertId: 1 }]); // INSERT 새 결제
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('학원비 일괄 생성에 실패했습니다.');
        expect(res.body.error).toBe('Server Error');
    });

    test('500: SQL 에러 시 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Academy SQL fail'));
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('학원비 일괄 생성에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('Academy SQL fail');
    });
});

describe('POST /paca/payments/generate-prorated', () => {
    test('400: student_id 누락', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('학생을 선택해주세요.');
    });

    test('404: 학생 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({ student_id: 999 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('학생을 찾을 수 없습니다.');
    });

    test('400: 이미 해당 월 납부건 존재', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, enrollment_date: '2026-05-15', class_days: '["월","수","금"]', tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[{ id: 1 }]]); // existing
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({ student_id: 7, enrollment_date: '2026-05-15' });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('이미 존재합니다');
    });

    test('201: 정상 생성 (lesson #206 — 핵심 SQL 호출만 검증)', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 10, payment_due_day: 5, enrollment_date: '2026-05-15', class_days: '["월","수","금"]', tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[]])                  // existing 없음
            .mockResolvedValueOnce([{ insertId: 42 }])    // INSERT student_payments
            .mockResolvedValueOnce([[
                { id: 42, student_name: 'enc_홍', final_amount: 90000, is_prorated: 1 },
            ]]);                                            // SELECT created
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({ student_id: 7, enrollment_date: '2026-05-15' });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('일할계산 납부건이 생성되었습니다.');
        expect(res.body.payment.id).toBe(42);
        expect(res.body.proration).toBeDefined();
        expect(res.body.proration.registration_day).toBe(15);

        // 핵심 SQL: INSERT student_payments
        const insertCall = pool.execute.mock.calls[2];
        expect(insertCall[0]).toContain('INSERT INTO student_payments');
        expect(insertCall[0]).toContain('is_prorated, proration_details');
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Student lookup fail'));
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({ student_id: 7 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('일할계산 납부건 생성에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('Student lookup fail');
    });
});

describe('POST /paca/payments/generate-monthly-for-student', () => {
    test('400: 필수 누락', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('필수 항목');
    });

    test('404: 학생 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 999, year: 2026, month: 5 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('학생을 찾을 수 없습니다.');
    });

    test('400: 이미 해당 월 납부건 존재', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[{ id: 1 }]]);
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 7, year: 2026, month: 5 });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('이미 존재합니다');
    });

    test('201: 정상 생성 (비시즌 종강 일할 미적용)', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 10, payment_due_day: 5, tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[]])                  // existing
            .mockResolvedValueOnce([[]])                  // calculateNonSeasonEndProrated SELECT (반환 0건 → null)
            .mockResolvedValueOnce([{ insertId: 50 }])
            .mockResolvedValueOnce([[
                { id: 50, student_name: 'enc_홍', final_amount: 90000 },
            ]]);
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 7, year: 2026, month: 5 });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('월 납부건이 생성되었습니다.');
        expect(res.body.payment.id).toBe(50);
        expect(res.body.nonSeasonProrated).toBeNull();
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Student fail'));
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 7, year: 2026, month: 5 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('월 납부건 생성에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('Student fail');
    });
});
