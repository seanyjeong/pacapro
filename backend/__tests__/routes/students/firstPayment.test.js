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
});
