/**
 * routes/payments/crud.js 테스트 (Phase 3 #6).
 *
 * 회귀 보호 범위:
 *   - GET    /paca/payments/:id → { payment }
 *   - POST   /paca/payments     → { message, payment } (201)
 *   - PUT    /paca/payments/:id → { message, payment }
 *   - DELETE /paca/payments/:id → { message, payment:{ id, student_name } }
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - 응답 표면 보존 (ADR-013)
 *   - PUT dynamic update — 11 필드 + base/discount/additional 변경 시 final_amount 재계산
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

describe('GET /paca/payments/:id', () => {
    test('200: { payment } + 학생 이름 복호화', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, student_id: 7, student_name: 'enc_홍길동', final_amount: 100000 },
        ]]);
        const res = await request(makeApp()).get('/paca/payments/1');
        expect(res.status).toBe(200);
        expect(res.body.payment.student_name).toBe('홍길동');
        expect(res.body.payment.id).toBe(1);
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toContain('remaining_amount');
        expect(sql).toContain('p.paid_amount');
        expect(params).toEqual([1, 5]);
    });

    test('404: 한국어 메시지', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/payments/999');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('납부 내역을 찾을 수 없습니다.');
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SQL fail'));
        const res = await request(makeApp()).get('/paca/payments/1');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('납부 내역을 불러오는데 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('SQL fail');
    });
});

describe('POST /paca/payments', () => {
    test('400: 필수 누락', async () => {
        const res = await request(makeApp()).post('/paca/payments').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('필수 항목');
    });

    test('404: 학생 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // student lookup
        const res = await request(makeApp())
            .post('/paca/payments')
            .send({
                student_id: 999,
                payment_type: 'monthly',
                base_amount: 100000,
                due_date: '2026-05-05',
                year_month: '2026-05',
            });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('학생을 찾을 수 없습니다.');
        expect(pool.execute.mock.calls[0][0]).toContain("status <> 'prospect'");
    });

    test('201: { message, payment } + truncateToThousands(base - discount + additional)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 7, academy_id: 5 }]]) // student lookup
            .mockResolvedValueOnce([[]])                         // 같은 달 월 청구 없음(학생 잠근 뒤)
            .mockResolvedValueOnce([{ insertId: 42 }])           // INSERT
            .mockResolvedValueOnce([[{ id: 42, student_id: 7, student_name: 'enc_홍길동', final_amount: 95000 }]]); // SELECT created
        const res = await request(makeApp())
            .post('/paca/payments')
            .send({
                student_id: 7,
                payment_type: 'monthly',
                base_amount: 100000,
                discount_amount: 5000,
                additional_amount: 0,
                due_date: '2026-05-05',
                year_month: '2026-05',
            });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('납부 내역이 생성되었습니다.');
        expect(res.body.payment.id).toBe(42);

        // INSERT params: final_amount = floor((100000 - 5000 + 0) / 1000) * 1000 = 95000
        const insertCall = pool.execute.mock.calls[2];
        expect(insertCall[1][7]).toBe(95000); // final_amount index
    });

    test('409: 같은 학생·같은 달 월 청구가 이미 있으면 만들지 않는다', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 7, academy_id: 5 }]])
            .mockResolvedValueOnce([[{ id: 41 }]]); // 같은 달 월 청구 있음
        const res = await request(makeApp())
            .post('/paca/payments')
            .send({ student_id: 7, payment_type: 'monthly', base_amount: 100000, due_date: '2026-05-05', year_month: '2026-05' });
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Conflict', message: '2026-05 월 학원비 청구가 이미 있습니다. 금액은 그 청구를 수정해 주세요.' });
        expect(pool.execute.mock.calls.some(([sql]) => /INSERT INTO student_payments/.test(sql))).toBe(false);
        expect(conn.rollback).toHaveBeenCalled();
    });

    test('201: 시즌비 등 다른 종류는 같은 달에 있어도 만든다(예전처럼)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 7, academy_id: 5 }]])
            .mockResolvedValueOnce([{ insertId: 43 }])
            .mockResolvedValueOnce([[{ id: 43, student_id: 7, student_name: 'enc_홍길동' }]]);
        const res = await request(makeApp())
            .post('/paca/payments')
            .send({ student_id: 7, payment_type: 'season', base_amount: 500000, due_date: '2026-05-05', year_month: '2026-05' });
        expect(res.status).toBe(201);
        expect(pool.execute.mock.calls.some(([sql]) => /payment_type = 'monthly' FOR UPDATE/.test(sql))).toBe(false);
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Insert fail'));
        const res = await request(makeApp())
            .post('/paca/payments')
            .send({
                student_id: 7,
                payment_type: 'monthly',
                base_amount: 100000,
                due_date: '2026-05-05',
                year_month: '2026-05',
            });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('납부 내역 생성에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('Insert fail');
    });
});

describe('PUT /paca/payments/:id', () => {
    test('404: 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // payment lookup
        const res = await request(makeApp())
            .put('/paca/payments/999')
            .send({ payment_type: 'season' });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('납부 내역을 찾을 수 없습니다.');
    });

    test('403: 다른 학원 결제', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, academy_id: 99 }]]); // 다른 학원
        const res = await request(makeApp())
            .put('/paca/payments/1')
            .send({ payment_type: 'season' });
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('접근 권한이 없습니다.');
    });

    test('400: 수정 항목 없음', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, academy_id: 5 }]]);
        const res = await request(makeApp()).put('/paca/payments/1').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('수정할 항목이 없습니다.');
    });

    test('200: dynamic update + final_amount 재계산', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, academy_id: 5 }]])                          // payment lookup
            .mockResolvedValueOnce([[{ base_amount: 100000, discount_amount: 0, additional_amount: 0, carryover_amount: 0, final_amount: 100000 }]]) // current
            .mockResolvedValueOnce([{ affectedRows: 1 }])                                   // UPDATE
            .mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍', final_amount: 80000 }]]); // SELECT updated
        const res = await request(makeApp())
            .put('/paca/payments/1')
            .send({ base_amount: 100000, discount_amount: 20000, additional_amount: 0 });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('납부 내역이 수정되었습니다.');
        expect(res.body.payment.student_name).toBe('홍');

        // UPDATE SQL 에 final_amount = ? 포함
        const updateCall = pool.execute.mock.calls[2];
        expect(updateCall[0]).toContain('final_amount = ?');
        // params 끝부분 = paymentId (마지막), 그 직전들이 dynamic update params
        expect(updateCall[1]).toContain(80000); // floor((100000 - 20000 + 0) / 1000) * 1000
    });

    test('200: 크레딧 적용 결제 금액 수정 시 carryover_amount 차감 보존', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 819, academy_id: 5 }]])
            .mockResolvedValueOnce([[
                { base_amount: '400000.00', discount_amount: '0.00', additional_amount: '0.00', carryover_amount: '99000.00', final_amount: '301000.00' },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 819, student_name: 'enc_유', final_amount: 300000 }]]);

        const res = await request(makeApp())
            .put('/paca/payments/819')
            .send({ discount_amount: 1000 });

        expect(res.status).toBe(200);
        const updateCall = pool.execute.mock.calls[2];
        expect(updateCall[0]).toContain('final_amount = ?');
        expect(updateCall[1]).toContain(300000);
    });

    test('200: 크레딧 차감액이 재계산 청구액보다 크면 final_amount 0으로 제한', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 819, academy_id: 5 }]])
            .mockResolvedValueOnce([[
                { base_amount: '50000.00', discount_amount: '0.00', additional_amount: '0.00', carryover_amount: '99000.00', final_amount: '0.00' },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 819, student_name: 'enc_유', final_amount: 0 }]]);

        const res = await request(makeApp())
            .put('/paca/payments/819')
            .send({ discount_amount: 0 });

        expect(res.status).toBe(200);
        const updateCall = pool.execute.mock.calls[2];
        expect(updateCall[1]).toContain(0);
    });

    // 화면은 저장할 때마다 학원비·할인·추가 금액을 다 보낸다 — UPDATE 의 final_amount 인자
    async function savedFinal(current, body) {
        pool.execute
            .mockResolvedValueOnce([[{ id: 820, academy_id: 5 }]])
            .mockResolvedValueOnce([[current]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 820, student_name: 'enc_유' }]]);
        const offset = pool.execute.mock.calls.length;
        const res = await request(makeApp()).put('/paca/payments/820').send(body);
        expect(res.status).toBe(200);
        const updateCall = pool.execute.mock.calls[offset + 2];
        return updateCall[1][updateCall[0].split('?').findIndex(part => /final_amount = $/.test(part))];
    }

    test('200: 월 청구와 같은 식 — 크레딧 166,500원·학원비 450,000원에 추가 10,000원 → 293,000원(크레딧 빼고 천원 절삭)', async () => {
        const { monthlyBillAmounts } = require('../../../utils/monthlyBillAmounts');
        const monthly = { base_amount: '450000.00', discount_amount: '0.00', additional_amount: '0.00', carryover_amount: 166500, final_amount: '283000.00' };
        // 예전 식(천원 절삭 뒤 크레딧 빼기)이면 293,500원
        const final = await savedFinal(monthly, { base_amount: 450000, discount_amount: 0, additional_amount: 10000 });
        expect(final).toBe(293000);
        // 같은 청구를 월 청구로 만든 금액과 같다
        expect(final).toBe(monthlyBillAmounts(450000, 0, 10000, 166500).final);
    });

    test('200: 금액 칸이 그대로면 최종 금액도 그대로(메모·납부기한만 고친 저장)', async () => {
        const monthly = { base_amount: '450000.00', discount_amount: '0.00', additional_amount: '0.00', carryover_amount: 166500, final_amount: '283000.00' };
        expect(await savedFinal(monthly, { base_amount: 450000, discount_amount: 0, additional_amount: 0, notes: 'x' })).toBe(283000);
    });

    test('200: 휴원 정산으로 최종 금액만 줄인 청구는 정액으로 돌아가지 않고, 바꾼 칸 차이만큼만 움직인다', async () => {
        // 학원비 450,000원 → 휴원 정산 225,000원 (학원비 칸은 그대로, 최종 금액만 줄임)
        const paused = { base_amount: '450000.00', discount_amount: '0.00', additional_amount: '0.00', carryover_amount: 0, final_amount: '225000.00' };
        // 예전: 저장만 해도 450,000원
        expect(await savedFinal(paused, { base_amount: 450000, discount_amount: 0, additional_amount: 0, notes: 'x' })).toBe(225000);
        expect(await savedFinal(paused, { base_amount: 450000, discount_amount: 0, additional_amount: 10000 })).toBe(235000);
    });

    test('200: 단일 필드만 변경 시 final_amount 재계산 X', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, academy_id: 5 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍' }]]);
        await request(makeApp())
            .put('/paca/payments/1')
            .send({ description: '메모 변경' });
        const updateCall = pool.execute.mock.calls[1];
        expect(updateCall[0]).not.toContain('final_amount = ?');
        expect(updateCall[0]).toContain('description = ?');
    });

    test('500: 한국어 메시지', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, academy_id: 5 }]])
            .mockRejectedValueOnce(new Error('UPDATE fail'));
        const res = await request(makeApp())
            .put('/paca/payments/1')
            .send({ payment_type: 'season' });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('납부 내역 수정에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('UPDATE fail');
    });
});

describe('DELETE /paca/payments/:id', () => {
    test('404: 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).delete('/paca/payments/999');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('납부 내역을 찾을 수 없습니다.');
    });

    test('200: { message, payment:{ id, student_name } }', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, student_id: 7, student_name: 'enc_홍길동' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        const res = await request(makeApp()).delete('/paca/payments/1');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('납부 내역이 삭제되었습니다.');
        expect(res.body.payment.id).toBe(1);
        // 원본 동작 보존: student_name 은 복호화 X (raw encrypted)
        expect(res.body.payment.student_name).toBe('enc_홍길동');
    });

    test('500: 한국어 메시지', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍' }]])
            .mockRejectedValueOnce(new Error('DELETE fail'));
        const res = await request(makeApp()).delete('/paca/payments/1');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('납부 내역 삭제에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DELETE fail');
    });
});
