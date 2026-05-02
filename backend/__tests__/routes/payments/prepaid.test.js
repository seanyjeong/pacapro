/**
 * routes/payments/prepaid.js 테스트 (Phase 3 #6).
 *
 * 회귀 보호 범위:
 *   - POST /paca/payments/prepaid-preview → { student_name, monthly_tuition, ... }
 *   - POST /paca/payments/prepaid-pay     → { message, prepaid_group_id, total_amount, total_discount, months_processed, months_skipped }
 *   - 트랜잭션 패턴 (lesson #217): conn.execute + commit/rollback + release
 *   - DB 호출: pool.execute / conn.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - validation 4xx: connection.release() 호출 (트랜잭션 시작 전)
 */

jest.mock('../../../config/database', () => {
    const conn = {
        execute: jest.fn(),
        query: jest.fn(),
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
    };
    return {
        execute: jest.fn(),
        query: jest.fn(),
        getConnection: jest.fn().mockResolvedValue(conn),
        __conn: conn,
    };
});

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 5, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => (typeof v === 'string' && v.startsWith('enc_') ? v.replace(/^enc_/, '') : v)),
}));

jest.mock('../../../utils/seasonCalculator', () => ({
    truncateToThousands: jest.fn((v) => Math.floor(v / 1000) * 1000),
    calculateProRatedFee: jest.fn(),
    parseWeeklyDays: jest.fn(),
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
const conn = pool.__conn;

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/payments/prepaid')(router);
    app.use('/paca/payments', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
    conn.execute.mockReset();
    conn.execute.mockResolvedValue([[]]);
    conn.beginTransaction.mockClear();
    conn.commit.mockClear();
    conn.rollback.mockClear();
    conn.release.mockClear();
    pool.getConnection.mockClear();
});

describe('POST /paca/payments/prepaid-preview', () => {
    test('400: months 길이 < 2', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-preview')
            .send({ student_id: 7, months: ['2026-05'], prepaid_discount_rate: 5 });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('학생 ID와 2~6개월 범위의 월 목록이 필요합니다.');
    });

    test('400: rate > 50', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-preview')
            .send({ student_id: 7, months: ['2026-05', '2026-06'], prepaid_discount_rate: 99 });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('선납 할인율은 0~50% 범위여야 합니다.');
    });

    test('404: 학생 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // student lookup
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-preview')
            .send({ student_id: 999, months: ['2026-05', '2026-06'], prepaid_discount_rate: 5 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('학생을 찾을 수 없습니다.');
    });

    test('200: 정상 미리보기 (2개월, new + already_paid 혼재)', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, status: 'active', tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[]]) // 2026-05 = new
            .mockResolvedValueOnce([[
                { id: 1, payment_status: 'paid', paid_amount: 100000, final_amount: 100000 },
            ]]); // 2026-06 = already_paid
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-preview')
            .send({ student_id: 7, months: ['2026-05', '2026-06'], prepaid_discount_rate: 5 });
        expect(res.status).toBe(200);
        expect(res.body.student_name).toBe('홍');
        expect(res.body.months_payable).toBe(1);
        expect(res.body.months_already_paid).toBe(1);
        expect(res.body.months[0].status).toBe('new');
        expect(res.body.months[1].status).toBe('already_paid');
        expect(res.body.months[1].final_amount).toBe(0); // already_paid 시 0
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SQL fail'));
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-preview')
            .send({ student_id: 7, months: ['2026-05', '2026-06'], prepaid_discount_rate: 5 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('선납 미리보기에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('SQL fail');
    });
});

describe('POST /paca/payments/prepaid-pay', () => {
    test('400 (validation): connection.release() 호출 + 트랜잭션 시작 X', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-pay')
            .send({ student_id: 7, months: ['2026-05'], prepaid_discount_rate: 5, payment_method: 'cash' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('학생 ID와 2~6개월 범위의 월 목록이 필요합니다.');
        expect(conn.release).toHaveBeenCalled();
        expect(conn.beginTransaction).not.toHaveBeenCalled();
    });

    test('400: 결제 방법 누락', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-pay')
            .send({ student_id: 7, months: ['2026-05', '2026-06'], prepaid_discount_rate: 5 });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('유효한 납부 방법을 선택해주세요.');
        expect(conn.release).toHaveBeenCalled();
    });

    test('404: 학생 미존재 + rollback + release', async () => {
        conn.execute.mockResolvedValueOnce([[]]); // student lookup
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-pay')
            .send({ student_id: 999, months: ['2026-05', '2026-06'], prepaid_discount_rate: 5, payment_method: 'cash' });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('학생을 찾을 수 없습니다.');
        expect(conn.beginTransaction).toHaveBeenCalled();
        expect(conn.rollback).toHaveBeenCalled();
        expect(conn.release).toHaveBeenCalled();
    });

    test('400: 비활성 학생 + rollback + release', async () => {
        conn.execute.mockResolvedValueOnce([[
            { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, status: 'rest', academy_id: 5, tuition_due_day: 5 },
        ]]);
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-pay')
            .send({ student_id: 7, months: ['2026-05', '2026-06'], prepaid_discount_rate: 5, payment_method: 'cash' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('재원 중인 학생만 선납 결제가 가능합니다.');
        expect(conn.rollback).toHaveBeenCalled();
        expect(conn.release).toHaveBeenCalled();
    });

    test('200: 정상 선납 (2개월, INSERT + UPDATE 혼재) + commit + release', async () => {
        conn.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, status: 'active', academy_id: 5, tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[]])                  // 2026-05 SELECT FOR UPDATE = 없음 → INSERT
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT 새
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT revenues
            .mockResolvedValueOnce([[
                { id: 11, payment_status: 'pending', paid_amount: 0, final_amount: 100000 },
            ]])                                             // 2026-06 SELECT FOR UPDATE = 미납 → UPDATE
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE 기존
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT revenues
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-pay')
            .send({
                student_id: 7,
                months: ['2026-05', '2026-06'],
                prepaid_discount_rate: 5,
                payment_method: 'cash',
                payment_date: '2026-05-02',
            });
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('선납 결제가 완료되었습니다');
        expect(res.body.months_processed).toEqual(['2026-05', '2026-06']);
        expect(res.body.months_skipped).toEqual([]);
        expect(typeof res.body.prepaid_group_id).toBe('string');
        expect(res.body.prepaid_group_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(conn.commit).toHaveBeenCalledTimes(1);
        expect(conn.release).toHaveBeenCalledTimes(1);
        expect(conn.rollback).not.toHaveBeenCalled();
    });

    test('200: 이미 완납인 월 → skip + months_skipped 에 포함', async () => {
        conn.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, status: 'active', academy_id: 5, tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[
                { id: 11, payment_status: 'paid', paid_amount: 100000, final_amount: 100000 },
            ]])                                             // 2026-05 = 이미 완납
            .mockResolvedValueOnce([[]])                  // 2026-06 = new
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // revenues
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-pay')
            .send({
                student_id: 7,
                months: ['2026-05', '2026-06'],
                prepaid_discount_rate: 5,
                payment_method: 'cash',
            });
        expect(res.status).toBe(200);
        expect(res.body.months_skipped).toEqual(['2026-05']);
        expect(res.body.months_processed).toEqual(['2026-06']);
    });

    test('500: SQL 에러 시 rollback + release + 한국어 메시지', async () => {
        conn.execute.mockRejectedValueOnce(new Error('Critical TX fail'));
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-pay')
            .send({
                student_id: 7,
                months: ['2026-05', '2026-06'],
                prepaid_discount_rate: 5,
                payment_method: 'cash',
            });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('선납 결제에 실패했습니다.');
        expect(conn.rollback).toHaveBeenCalled();
        expect(conn.release).toHaveBeenCalled();
        expect(JSON.stringify(res.body)).not.toContain('Critical TX fail');
    });
});
