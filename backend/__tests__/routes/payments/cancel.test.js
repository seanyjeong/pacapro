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
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => (typeof v === 'string' && v.startsWith('enc_') ? v.replace(/^enc_/, '') : v)),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
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
    require('../../../routes/payments/cancel')(router);
    app.use('/paca/payments', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
    logger.info.mockClear();
});

describe('POST /paca/payments/:id/cancel', () => {
    test('400: 취소 금액 필수', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/1/cancel')
            .send({ cancel_reason: '카드 승인 취소' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('취소 금액을 입력해주세요.');
        expect(pool.execute).not.toHaveBeenCalled();
    });

    test('400: 취소 사유 필수', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/1/cancel')
            .send({ cancel_amount: 10000 });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('결제 취소 사유를 입력해주세요.');
    });

    test('404: 결제 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        const res = await request(makeApp())
            .post('/paca/payments/999/cancel')
            .send({ cancel_amount: 10000, cancel_reason: '카드 승인 취소' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('납부 내역을 찾을 수 없습니다.');
    });

    test('400: 현재 납부액보다 큰 금액은 취소할 수 없음', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, paid_amount: 50000, final_amount: 100000, payment_status: 'partial' },
        ]]);

        const res = await request(makeApp())
            .post('/paca/payments/1/cancel')
            .send({ cancel_amount: 60000, cancel_reason: '중복 결제' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('현재 납부액보다 큰 금액은 취소할 수 없습니다.');
    });

    test('200: 부분 취소 시 납부액 차감, partial 상태 유지, 취소 사유 기록', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                {
                    id: 1,
                    academy_id: 5,
                    student_id: 7,
                    payment_type: 'monthly',
                    paid_amount: 120000,
                    final_amount: 520000,
                    payment_status: 'partial',
                    payment_method: 'account',
                    paid_date: '2026-07-01',
                    description: '7월 수강료',
                },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍길동', paid_amount: 70000, payment_status: 'partial' }]]);

        const res = await request(makeApp())
            .post('/paca/payments/1/cancel')
            .send({ cancel_amount: 50000, cancel_reason: '카드 승인 취소', cancel_date: '2026-07-07' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('결제 취소가 기록되었습니다.');
        expect(res.body.payment.student_name).toBe('홍길동');

        const updateCall = pool.execute.mock.calls[1];
        expect(updateCall[0]).toContain('UPDATE student_payments');
        expect(updateCall[1][0]).toBe(70000);
        expect(updateCall[1][1]).toBe('partial');
        expect(updateCall[1][4]).toContain('카드 승인 취소');

        const revenueCall = pool.execute.mock.calls[2];
        expect(revenueCall[0]).toContain('INSERT INTO revenues');
        expect(revenueCall[1][2]).toBe(-50000);
        expect(revenueCall[1][6]).toContain('결제 취소');
    });

    test('200: 전액 취소 시 pending 상태로 되돌리고 납부일/방법을 비운다', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                {
                    id: 1,
                    academy_id: 5,
                    student_id: 7,
                    payment_type: 'season',
                    paid_amount: 120000,
                    final_amount: 120000,
                    payment_status: 'paid',
                    payment_method: 'card',
                    paid_date: '2026-07-01',
                    description: '시즌비',
                },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockRejectedValueOnce(new Error('revenues missing'))
            .mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍길동', paid_amount: 0, payment_status: 'pending' }]]);

        const res = await request(makeApp())
            .post('/paca/payments/1/cancel')
            .send({ cancel_amount: 120000, cancel_reason: '환불 처리' });

        expect(res.status).toBe(200);
        const updateCall = pool.execute.mock.calls[1];
        expect(updateCall[1][0]).toBe(0);
        expect(updateCall[1][1]).toBe('pending');
        expect(updateCall[1][2]).toBeNull();
        expect(updateCall[1][3]).toBeNull();
        expect(logger.info).toHaveBeenCalledWith('Revenue cancellation insert skipped:', expect.stringContaining('revenues'));
    });
});
