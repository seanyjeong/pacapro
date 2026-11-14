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

// 학생 잠금(SELECT … FOR UPDATE)은 실제 MySQL 시험(integration/pending-bill-mysql)에서 확인 — 여기선 호출 순서만 본다
jest.mock('../../../repositories/studentBillingLock', () => ({ lockStudentForBilling: jest.fn().mockResolvedValue({ id: 1 }) }));
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

    test('200: 미리보기도 실행과 같은 금액 — 기존 미납 청구의 추가 금액·크레딧을 넣어 천원 절삭', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, status: 'active', tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[]]) // 2026-05 = new
            .mockResolvedValueOnce([[
                { id: 11, payment_status: 'pending', paid_amount: 0, base_amount: '100000.00', discount_amount: '0.00', additional_amount: '10000.00', carryover_amount: 30000, final_amount: '80000.00' },
            ]]); // 2026-06 = existing_unpaid
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-preview')
            .send({ student_id: 7, months: ['2026-05', '2026-06'], prepaid_discount_rate: 5 });
        expect(res.status).toBe(200);
        expect(res.body.months.map(m => [m.status, m.prepaid_discount, m.final_amount])).toEqual([['new', 5000, 95000], ['existing_unpaid', 5000, 75000]]);
        expect(res.body.total_final).toBe(170000);
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
                { id: 11, payment_status: 'pending', paid_amount: 0, base_amount: '100000.00', discount_amount: '0.00', additional_amount: '10000.00', carryover_amount: 30000, final_amount: '80000.00' },
            ]])                                             // 2026-06 SELECT FOR UPDATE = 미납(추가 10,000원·크레딧 30,000원) → UPDATE
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
        // 새 청구: 100,000 − 선납 5,000 = 95,000
        const insert = conn.execute.mock.calls.find(([sql]) => /INSERT INTO student_payments/.test(sql));
        expect(insert[1].slice(3, 6)).toEqual([100000, 5000, 95000]);
        // 기존 미납 청구: 추가 금액·이미 적용된 크레딧을 지켜 천원 절삭(100,000 − 5,000 + 10,000 − 30,000 = 75,000), 예전엔 95,000
        const update = conn.execute.mock.calls.find(([sql]) => /UPDATE student_payments SET/.test(sql));
        expect(update[1].slice(0, 4)).toEqual([100000, 5000, 75000, 75000]);
        expect(res.body.total_amount).toBe(95000 + 75000);
    });

    test('200: 일부 납부(50,000원)한 청구는 남은 금액만 매출에 넣고 paid_amount 는 최종 금액', async () => {
        conn.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, status: 'active', academy_id: 5, tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[
                { id: 11, payment_status: 'partial', paid_amount: '50000.00', base_amount: '100000.00', discount_amount: '0.00', additional_amount: '0.00', carryover_amount: 0, final_amount: '100000.00' },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // revenues
            .mockResolvedValueOnce([[]])                  // 2026-06 = new
            .mockResolvedValueOnce([{ insertId: 12 }])    // INSERT
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // revenues
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-pay')
            .send({ student_id: 7, months: ['2026-05', '2026-06'], prepaid_discount_rate: 5, payment_method: 'cash' });
        expect(res.status).toBe(200);
        const update = conn.execute.mock.calls.find(([sql]) => /UPDATE student_payments SET/.test(sql));
        expect(update[1].slice(2, 4)).toEqual([95000, 95000]); // final, paid_amount
        const revenues = conn.execute.mock.calls.filter(([sql]) => /INSERT INTO revenues/.test(sql));
        // 남은 금액 95,000 − 50,000 = 45,000 (예전 95,000 — 일부 납부 50,000원이 두 번 잡혔다), 새 달 95,000 — payment_id 로 청구 연결
        expect(revenues.map(([sql, params]) => [params[1], params[3]])).toEqual([[45000, 11], [95000, 12]]);
        expect(revenues[0][0]).not.toMatch(/payment_method/);
        expect(res.body.total_amount).toBe(45000 + 95000);
    });

    test('400: 선납 할인으로 최종 금액이 이미 낸 금액보다 작아지면 선납 전체를 막고 되돌린다', async () => {
        conn.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, status: 'active', academy_id: 5, tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[]]) // 2026-05 = new
            .mockResolvedValueOnce([{ insertId: 12 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[
                { id: 11, payment_status: 'partial', paid_amount: '98000.00', base_amount: '100000.00', discount_amount: '0.00', additional_amount: '0.00', carryover_amount: 0, final_amount: '100000.00' },
            ]]);
        const res = await request(makeApp())
            .post('/paca/payments/prepaid-pay')
            .send({ student_id: 7, months: ['2026-05', '2026-06'], prepaid_discount_rate: 5, payment_method: 'cash' });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('2026-06은 이미 낸 금액(98,000원)이 선납 금액(95,000원)보다 많습니다');
        expect(conn.rollback).toHaveBeenCalled();
        expect(conn.commit).not.toHaveBeenCalled();
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
