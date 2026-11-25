/**
 * routes/payments/crud.js PUT — 청구액 직접 입력(final_amount)과 시즌 청구 추가 금액 잠금.
 */

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
}));

// 학생 잠금(SELECT … FOR UPDATE)은 실제 MySQL 시험(integration/pending-bill-mysql)에서 확인
jest.mock('../../../repositories/studentBillingLock', () => ({ lockStudentForBilling: jest.fn().mockResolvedValue({ id: 7 }) }));

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
const conn = {
    execute: (...args) => pool.execute(...args),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
};

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/payments/crud')(router);
    app.use('/paca/payments', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
    pool.getConnection.mockResolvedValue(conn);
    conn.rollback.mockClear();
});

describe('청구액 직접 입력(final_amount)', () => {
    const seasonBill = {
        base_amount: '3700000.00', discount_amount: '0.00', additional_amount: '189000.00', carryover_amount: 0, final_amount: '3511000.00',
        payment_type: 'season', season_id: 21, paid_amount: '0.00', payment_status: 'pending', notes: null
    };

    async function put(current, body) {
        pool.execute.mockReset();
        pool.execute
            .mockResolvedValueOnce([[{ id: 820, student_id: 7, academy_id: 5 }]])
            .mockResolvedValueOnce([[current]])
            .mockResolvedValue([[{ id: 820, student_name: 'enc_유' }]]);
        const res = await request(makeApp()).put('/paca/payments/820').send(body);
        const call = pattern => pool.execute.mock.calls.find(([sql]) => pattern.test(sql));
        const update = call(/UPDATE student_payments/);
        const value = column => update[1][update[0].split('?').findIndex(part => part.endsWith(`${column} = `))];
        return { res, update, value, seasonUpdate: call(/UPDATE student_seasons/) };
    }

    test('200: 적은 금액이 그대로 청구액 — 나머지 금액 칸은 그대로, 등록의 시즌비도 같게, 메모에 남긴다', async () => {
        const { res, update, value, seasonUpdate } = await put(seasonBill, { final_amount: 3700500, notes: '메모' });
        expect(res.status).toBe(200);
        expect(value('final_amount')).toBe(3700500);
        expect(value('payment_status')).toBe('pending');
        expect(value('notes')).toBe('메모\n청구액 직접 수정: 3,511,000원 → 3,700,500원');
        expect(update[0]).not.toMatch(/base_amount = |discount_amount = |additional_amount = /);
        expect(seasonUpdate[1]).toEqual([3700500, 7, 21]);
    });

    test('200: 받은 돈에 맞춰 납부 상태가 바뀐다', async () => {
        const partial = { ...seasonBill, paid_amount: '3000000.00', payment_status: 'partial' };
        expect((await put(partial, { final_amount: 3000000 })).value('payment_status')).toBe('paid');
        const paid = { ...seasonBill, paid_amount: '3511000.00', payment_status: 'paid' };
        expect((await put(paid, { final_amount: 3700000 })).value('payment_status')).toBe('partial');
        // 0원으로 완납 처리한 청구에 금액을 매기면 미납
        const free = { ...seasonBill, final_amount: '0.00', payment_status: 'paid' };
        expect((await put(free, { final_amount: 100000 })).value('payment_status')).toBe('pending');
        // 두 번 깎인 청구(받은 돈 > 청구액)를 받은 돈에 맞추면 완납 그대로
        const broken = { ...seasonBill, additional_amount: '0.00', final_amount: '3322000.00', paid_amount: '3700000.00', payment_status: 'paid' };
        expect((await put(broken, { final_amount: 3700000 })).value('payment_status')).toBe('paid');
    });

    test('200: 월 청구도 되고 시즌 등록은 건드리지 않는다', async () => {
        const monthly = { ...seasonBill, payment_type: 'monthly', season_id: null, additional_amount: '0.00', final_amount: '3700000.00' };
        const { value, seasonUpdate } = await put(monthly, { final_amount: 333333 });
        expect(value('final_amount')).toBe(333333);
        expect(seasonUpdate).toBeUndefined();
    });

    test('200: 금액 칸을 같이 바꾸고 지금 청구액을 적어도 적은 금액이 청구액', async () => {
        const monthly = { ...seasonBill, payment_type: 'monthly', season_id: null, base_amount: '500000.00', additional_amount: '0.00', final_amount: '500000.00' };
        const raised = await put(monthly, { base_amount: 550000, final_amount: 500000 });
        expect(raised.value('base_amount')).toBe(550000);
        expect(raised.value('final_amount')).toBe(500000);
        expect((await put(monthly, { discount_amount: 50000, final_amount: 500000 })).value('final_amount')).toBe(500000);
    });

    test('낸 금액이 비어 있는 예전 완납 청구는 청구액을 받은 것으로 본다', async () => {
        for (const paidAmount of ['0.00', null]) {
            const old = { ...seasonBill, payment_type: 'monthly', season_id: null, base_amount: '500000.00', additional_amount: '0.00', final_amount: '500000.00', paid_amount: paidAmount, payment_status: 'paid' };
            const lower = await put(old, { final_amount: 450000 });
            expect(lower.res.status).toBe(400);
            expect(lower.update).toBeUndefined();
            const higher = await put(old, { final_amount: 600000 });
            expect(higher.value('payment_status')).toBe('partial');
            expect(higher.value('paid_amount')).toBe(500000);
        }
    });

    test('200: 지금 청구액과 같으면 아무 금액도 바꾸지 않는다', async () => {
        const { update, seasonUpdate } = await put(seasonBill, { final_amount: 3511000, description: 'x' });
        expect(update[0]).not.toContain('final_amount = ?');
        expect(update[0]).not.toContain('payment_status = ?');
        expect(seasonUpdate).toBeUndefined();
    });

    test('400: 받은 돈보다 낮게·음수·소수·글자·취소 청구는 막고 아무것도 쓰지 않는다', async () => {
        const paid = { ...seasonBill, paid_amount: '3511000.00', payment_status: 'paid' };
        for (const [current, body] of [
            [paid, { final_amount: 3500000 }], [seasonBill, { final_amount: -1 }], [seasonBill, { final_amount: 1000.5 }],
            [seasonBill, { final_amount: '3700000' }], [seasonBill, { final_amount: null }],
            [seasonBill, { final_amount: 3000000, paid_amount: 3000000 }], [seasonBill, { final_amount: 3000000, payment_status: 'paid' }], [{ ...seasonBill, payment_status: 'cancelled' }, { final_amount: 1000 }]
        ]) {
            const { res, update } = await put(current, body);
            expect(res.status).toBe(400);
            expect(update).toBeUndefined();
        }
    });

    test('400: 일할·할인이 든 시즌 청구의 추가 금액은 바꿀 수 없다(0으로 지우면 3,322,000원으로 두 번 깎이던 것)', async () => {
        const { res, update } = await put(seasonBill, { additional_amount: 0 });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('청구액을 직접 입력해 주세요.');
        expect(update).toBeUndefined();
    });
});
