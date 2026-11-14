jest.mock('../../../config/database', () => ({ execute: jest.fn() }));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../../../utils/dueDateCalculator', () => ({
    calculateDueDate: jest.fn(() => '2026-07-01'),
}));
jest.mock('../../../routes/students/_utils', () => ({
    parseClassDaysWithSlots: jest.fn(() => []),
    extractDayNumbers: jest.fn(() => []),
    truncateToThousands: jest.fn((value) => Math.floor(value / 1000) * 1000),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/students/firstPayment')(router);
    app.use('/paca/students', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
});

describe('POST /paca/students/:id/recalculate-first-payment', () => {
    test('재계산한 첫 달 일할 청구의 납부기한은 등록일이다', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                {
                    id: 5,
                    enrollment_date: '2026-07-20',
                    monthly_tuition: 300000,
                    discount_rate: 0,
                    class_days: '[]',
                    time_slot: 'evening',
                    payment_due_day: 1,
                },
            ]])
            .mockResolvedValueOnce([[{ id: 77, payment_status: 'pending' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(makeApp())
            .post('/paca/students/5/recalculate-first-payment')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.payment.due_date).toBe('2026-07-20');
        const updatePayment = pool.execute.mock.calls.find(([sql]) => /UPDATE student_payments/.test(sql));
        expect(updatePayment[1]).toContain('2026-07-20');
        expect(updatePayment[1]).not.toContain('2026-07-27');
    });

    test('이미 적용한 크레딧과 추가 금액은 재계산 뒤에도 최종 금액에 남는다', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                {
                    id: 5,
                    enrollment_date: '2026-11-16',
                    monthly_tuition: 300000,
                    discount_rate: 0,
                    class_days: '[]',
                    time_slot: 'evening',
                },
            ]])
            .mockResolvedValueOnce([[{ id: 77, payment_status: 'pending', additional_amount: '5000.00', carryover_amount: '12000.00' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(makeApp())
            .post('/paca/students/5/recalculate-first-payment')
            .send({});

        // 11월 30일 중 15일: 300,000 × 15/30 = 150,000 → + 추가 5,000 - 크레딧 12,000
        expect(res.status).toBe(200);
        expect(res.body.payment.final_amount).toBe(143000);
        const updatePayment = pool.execute.mock.calls.find(([sql]) => /UPDATE student_payments/.test(sql));
        expect(updatePayment[1][2]).toBe(143000);
    });

    test('천원 단위가 아닌 크레딧은 빼고 나서 천원 절삭한다(월 청구·청구 수정과 같은 식)', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                {
                    id: 5,
                    enrollment_date: '2026-11-16',
                    monthly_tuition: 300000,
                    discount_rate: 0,
                    class_days: '[]',
                    time_slot: 'evening',
                },
            ]])
            .mockResolvedValueOnce([[{ id: 77, payment_status: 'pending', additional_amount: '0.00', carryover_amount: '12500.00' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(makeApp())
            .post('/paca/students/5/recalculate-first-payment')
            .send({});

        // 150,000 − 크레딧 12,500 = 137,500 → 137,000 (예전 식은 절삭 뒤 크레딧을 빼 137,500)
        expect(res.status).toBe(200);
        expect(res.body.payment.final_amount).toBe(137000);
    });
});
