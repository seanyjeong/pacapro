/**
 * routes/payments/pay.js 테스트 (Phase 3 #6).
 *
 * 회귀 보호 범위:
 *   - POST /paca/payments/:id/pay → { message, payment }
 *   - 0원 청구 + 0원 납부 허용 (100% 할인)
 *   - 추가 할인 적용 시 final_amount 감소 + notes 기록
 *   - revenues INSERT 실패 시 무시 (logger.info)
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건 (details 는 dev 전용)
 *   - 응답 표면 보존 (ADR-013)
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
    decrypt: jest.fn((v) => (typeof v === 'string' && v.startsWith('enc_') ? v.replace(/^enc_/, '') : v)),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const logger = require('../../../utils/logger');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/payments/pay')(router);
    app.use('/paca/payments', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
    logger.info.mockClear();
});

describe('POST /paca/payments/:id/pay', () => {
    test('400: 필수 누락', async () => {
        const res = await request(makeApp()).post('/paca/payments/1/pay').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('필수 항목');
    });

    test('404: 결제 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/payments/999/pay')
            .send({ paid_amount: 100000, payment_method: 'cash' });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('납부 내역을 찾을 수 없습니다.');
    });

    test('400: 이미 완납', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, payment_status: 'paid', final_amount: 100000, paid_amount: 100000, discount_amount: 0 },
        ]]);
        const res = await request(makeApp())
            .post('/paca/payments/1/pay')
            .send({ paid_amount: 1000, payment_method: 'cash' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('이미 완납된 내역입니다.');
    });

    test('400: 음수 납부 금액', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, payment_status: 'pending', final_amount: 100000, paid_amount: 0, discount_amount: 0 },
        ]]);
        const res = await request(makeApp())
            .post('/paca/payments/1/pay')
            .send({ paid_amount: -100, payment_method: 'cash' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('납부 금액은 0원 이상이어야 합니다.');
    });

    test('400: 0원 납부인데 청구액 > 0', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, payment_status: 'pending', final_amount: 100000, paid_amount: 0, discount_amount: 0 },
        ]]);
        const res = await request(makeApp())
            .post('/paca/payments/1/pay')
            .send({ paid_amount: 0, payment_method: 'cash' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('납부 금액은 0원보다 커야 합니다.');
    });

    test('200: 0원 청구 + 0원 납부 허용 (100% 할인)', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 1, payment_type: 'monthly', payment_status: 'pending', final_amount: 0, paid_amount: 0, discount_amount: 100000, academy_id: 5, student_id: 7, description: 'desc' },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE student_payments
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT revenues
            .mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍' }]]); // SELECT updated
        const res = await request(makeApp())
            .post('/paca/payments/1/pay')
            .send({ paid_amount: 0, payment_method: 'cash' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('납부가 기록되었습니다.');
    });

    test('200: 정상 납부 (full) → payment_status = paid', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 1, payment_type: 'monthly', payment_status: 'pending', final_amount: 100000, paid_amount: 0, discount_amount: 0, academy_id: 5, student_id: 7, description: 'desc' },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍', payment_status: 'paid' }]]);
        const res = await request(makeApp())
            .post('/paca/payments/1/pay')
            .send({ paid_amount: 100000, payment_method: 'card', payment_date: '2026-05-02' });
        expect(res.status).toBe(200);

        // UPDATE: payment_status = 'paid'
        const updateCall = pool.execute.mock.calls[1];
        expect(updateCall[0]).toContain('UPDATE student_payments');
        expect(updateCall[1][3]).toBe('paid'); // paymentStatus index
        expect(updateCall[1][4]).toBe('card'); // payment_method
        expect(updateCall[1][5]).toBe('2026-05-02'); // paid_date
    });

    test('200: partial 납부 → payment_status = partial', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 1, payment_type: 'monthly', payment_status: 'pending', final_amount: 100000, paid_amount: 0, discount_amount: 0, academy_id: 5, student_id: 7, description: 'd' },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍' }]]);
        await request(makeApp())
            .post('/paca/payments/1/pay')
            .send({ paid_amount: 50000, payment_method: 'cash' });
        const updateCall = pool.execute.mock.calls[1];
        expect(updateCall[1][3]).toBe('partial');
    });

    test('200: 추가 할인 (discount_amount) → final_amount 감소 + notes 기록', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 1, payment_type: 'monthly', payment_status: 'pending', final_amount: 100000, paid_amount: 0, discount_amount: 0, academy_id: 5, student_id: 7, description: 'd' },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 1 }]]);
        await request(makeApp())
            .post('/paca/payments/1/pay')
            .send({ paid_amount: 95000, payment_method: 'cash', discount_amount: 5000 });
        const updateCall = pool.execute.mock.calls[1];
        expect(updateCall[1][1]).toBe(95000); // newFinalAmount = 100000 - 5000
        expect(updateCall[1][2]).toBe(5000);  // newDiscountAmount = 0 + 5000
        // notes 에 할인 기록
        expect(updateCall[1][6]).toContain('할인');
        expect(updateCall[1][6]).toContain('5000');
    });

    test('revenues INSERT 실패 → logger.info skip + 정상 응답', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 1, payment_type: 'season', payment_status: 'pending', final_amount: 100000, paid_amount: 0, discount_amount: 0, academy_id: 5, student_id: 7, description: '시즌비' },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockRejectedValueOnce(new Error('table revenues does not exist')) // INSERT revenues 실패
            .mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍' }]]);
        const res = await request(makeApp())
            .post('/paca/payments/1/pay')
            .send({ paid_amount: 100000, payment_method: 'cash' });
        expect(res.status).toBe(200);
        expect(logger.info).toHaveBeenCalledWith('Revenue table insert skipped:', expect.stringContaining('revenues'));

        // payment_type === 'season' 분기 검증
        const revenueCall = pool.execute.mock.calls[2];
        expect(revenueCall[1][1]).toBe('season'); // category
        expect(revenueCall[1][6]).toContain('시즌비 납부');
    });

    test('500: 한국어 메시지 + e.message 누출 0건 (production)', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Critical SQL fail'));
        const res = await request(makeApp())
            .post('/paca/payments/1/pay')
            .send({ paid_amount: 1000, payment_method: 'cash' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBe('납부 기록에 실패했습니다.');
        // details 는 NODE_ENV=development 일 때만 (test 환경 = development 일 수 있음 — 누출 X 보장)
        if (process.env.NODE_ENV !== 'development') {
            expect(JSON.stringify(res.body)).not.toContain('Critical SQL fail');
        }
    });
});
