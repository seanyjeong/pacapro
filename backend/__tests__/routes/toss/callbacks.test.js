/**
 * routes/toss/callbacks.js 테스트 (Phase 3 #8).
 *
 * 회귀 보호 범위:
 *   - POST /paca/toss/payment-callback: 중복 / academyId 누락 큐 / orderId 형식 큐 / payment 미존재 큐 / 정상 매칭
 *   - POST /paca/toss/cancel-callback: 원본 이력 미존재 큐 / 이미 취소 / 정상 환불
 *   - DB 호출: conn.execute (트랜잭션, ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - 응답 표면 보존 (ADR-013): {success, matched, queueReason, paymentId, ...} 1:1
 *   - 보안 (ADR-007): verifyCallbackSignature 통과 시그니처 무변경 (HMAC 검증은 _utils 책임)
 *   - lesson #206 적용: 거대 endpoint 정상 케이스는 핵심 SQL 호출 (UPDATE student_payments / INSERT history) 만 검증
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

jest.mock('../../../utils/encryption', () => ({
    encrypt: jest.fn((v) => v),
    decrypt: jest.fn((v) => v),
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
    require('../../../routes/toss/callbacks')(router);
    app.use('/paca/toss', router);
    return app;
}

beforeEach(() => {
    conn.execute.mockReset();
    conn.execute.mockResolvedValue([[]]);
    conn.beginTransaction.mockClear();
    conn.commit.mockClear();
    conn.rollback.mockClear();
    conn.release.mockClear();
    pool.getConnection.mockClear();
    pool.execute.mockReset();
});

describe('POST /paca/toss/payment-callback', () => {
    test('중복 결제: {success, message, duplicate:true}', async () => {
        // 첫 SELECT 가 기존 record 1건 반환 → 중복 처리 분기
        conn.execute.mockResolvedValueOnce([[{ id: 1 }]]);
        const res = await request(makeApp())
            .post('/paca/toss/payment-callback')
            .send({ orderId: 'PACA-1-123', paymentKey: 'pk-dup', amount: 1000, status: 'DONE' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.duplicate).toBe(true);
        expect(res.body.message).toBe('이미 처리된 결제입니다.');
        expect(conn.rollback).toHaveBeenCalled();
    });

    test('큐 fallback: academyId 누락 → queueReason ACADEMY_ID_MISSING', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[]]); // 중복 없음
        conn.execute.mockResolvedValueOnce([{ insertId: 1 }]); // INSERT queue
        const res = await request(makeApp())
            .post('/paca/toss/payment-callback')
            .send({ orderId: 'PACA-1-999', paymentKey: 'pk-1', amount: 5000, method: 'CARD' });
        expect(res.status).toBe(200);
        expect(res.body.matched).toBe(false);
        expect(res.body.queueReason).toBe('ACADEMY_ID_MISSING');
        // 큐 INSERT 의 academy_id 가 NULL 인지 확인
        const insertSql = conn.execute.mock.calls[1][0];
        expect(insertSql).toMatch(/INSERT INTO toss_payment_queue[\s\S]+VALUES \(NULL, /);
        expect(conn.commit).toHaveBeenCalled();
    });

    test('큐 fallback: orderId 형식 불일치 → queueReason ORDER_ID_FORMAT', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[]]); // 중복 없음
        conn.execute.mockResolvedValueOnce([{ insertId: 2 }]); // INSERT queue
        const res = await request(makeApp())
            .post('/paca/toss/payment-callback')
            .send({
                orderId: 'WRONG-FORMAT',
                paymentKey: 'pk-2',
                amount: 5000,
                method: 'CARD',
                metadata: { academyId: 5 }
            });
        expect(res.status).toBe(200);
        expect(res.body.matched).toBe(false);
        expect(res.body.queueReason).toBe('ORDER_ID_FORMAT');
    });

    test('큐 fallback: payment_id 미존재 → queueReason PAYMENT_NOT_FOUND + match_status error', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[]]); // 중복 없음
        conn.execute.mockResolvedValueOnce([[]]); // SELECT student_payments 비어있음
        conn.execute.mockResolvedValueOnce([{ insertId: 3 }]); // INSERT queue
        const res = await request(makeApp())
            .post('/paca/toss/payment-callback')
            .send({
                orderId: 'PACA-99-123',
                paymentKey: 'pk-3',
                amount: 5000,
                method: 'CARD',
                metadata: { academyId: 5 }
            });
        expect(res.status).toBe(200);
        expect(res.body.matched).toBe(false);
        expect(res.body.queueReason).toBe('PAYMENT_NOT_FOUND');
        // 큐 INSERT 의 match_status = error
        const insertSql = conn.execute.mock.calls[2][0];
        expect(insertSql).toMatch(/'error'/);
    });

    test('정상 매칭: {success, matched:true, paymentId, studentPaymentStatus, paidAmount, remainingAmount} + UPDATE student_payments + INSERT history (lesson #206)', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[]]); // 중복 없음
        conn.execute.mockResolvedValueOnce([[
            { id: 7, academy_id: 5, paid_amount: 50000, final_amount: 200000 }
        ]]); // SELECT student_payments
        conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE student_payments
        conn.execute.mockResolvedValueOnce([{ insertId: 100 }]); // INSERT toss_payment_history
        const res = await request(makeApp())
            .post('/paca/toss/payment-callback')
            .send({
                orderId: 'PACA-7-1234567890',
                paymentKey: 'pk-ok',
                amount: 100000,
                status: 'DONE',
                method: 'CARD',
                approvedAt: '2024-12-15T10:00:00Z',
                receipt: { url: 'https://r/a' },
                card: { company: '신한', number: '1234', installmentPlanMonths: 0 },
                metadata: { academyId: 5 }
            });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.matched).toBe(true);
        expect(res.body.paymentId).toBe(7);
        expect(res.body.studentPaymentStatus).toBe('partial'); // 150k < 200k
        expect(res.body.paidAmount).toBe(150000);
        expect(res.body.remainingAmount).toBe(50000);
        // 핵심 SQL 호출 검증 (lesson #206)
        expect(conn.execute.mock.calls[2][0]).toMatch(/UPDATE student_payments SET[\s\S]+paid_amount/);
        expect(conn.execute.mock.calls[3][0]).toMatch(/INSERT INTO toss_payment_history/);
        expect(conn.commit).toHaveBeenCalled();
    });

    test('5xx: 한국어 메시지 (ADR-003) + rollback 호출', async () => {
        conn.execute.mockReset();
        conn.execute.mockRejectedValueOnce(new Error('DB error'));
        const res = await request(makeApp())
            .post('/paca/toss/payment-callback')
            .send({ orderId: 'PACA-1-2', paymentKey: 'pk', amount: 1000 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('결제 처리에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB error/);
        expect(conn.rollback).toHaveBeenCalled();
    });
});

describe('POST /paca/toss/cancel-callback', () => {
    test('큐 fallback: 원본 이력 미존재 → queueReason ORIGINAL_NOT_FOUND', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[]]); // SELECT history 비어있음
        conn.execute.mockResolvedValueOnce([{ insertId: 1 }]); // INSERT queue
        const res = await request(makeApp())
            .post('/paca/toss/cancel-callback')
            .send({
                orderId: 'PACA-1-999',
                paymentKey: 'pk-1',
                cancelAmount: 5000,
                cancelReason: 'test',
                canceledAt: '2024-12-15T10:00:00Z'
            });
        expect(res.status).toBe(200);
        expect(res.body.matched).toBe(false);
        expect(res.body.queueReason).toBe('ORIGINAL_NOT_FOUND');
    });

    test('이미 취소: {success, message, duplicate:true}', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[
            { id: 1, payment_id: 7, academy_id: 5, status: 'CANCELED', amount: 5000 }
        ]]);
        const res = await request(makeApp())
            .post('/paca/toss/cancel-callback')
            .send({ orderId: 'X', paymentKey: 'pk-c', cancelAmount: 5000 });
        expect(res.status).toBe(200);
        expect(res.body.duplicate).toBe(true);
        expect(res.body.message).toBe('이미 취소된 결제입니다.');
        expect(conn.rollback).toHaveBeenCalled();
    });

    test('404: 결제 내역 미존재', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[
            { id: 1, payment_id: 7, academy_id: 5, status: 'DONE', amount: 5000 }
        ]]); // history 있음
        conn.execute.mockResolvedValueOnce([[]]); // student_payments 미존재
        const res = await request(makeApp())
            .post('/paca/toss/cancel-callback')
            .send({ orderId: 'X', paymentKey: 'pk-c', cancelAmount: 5000 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('결제 내역을 찾을 수 없습니다.');
    });

    test('정상 환불: {success, matched:true, paymentId, refundAmount, newStatus, newPaidAmount, remainingAmount} (lesson #206)', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[
            { id: 1, payment_id: 7, academy_id: 5, status: 'DONE', amount: 100000 }
        ]]); // SELECT history
        conn.execute.mockResolvedValueOnce([[
            { id: 7, paid_amount: 150000, final_amount: 200000 }
        ]]); // SELECT student_payments
        conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE student_payments
        conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE toss_payment_history
        const res = await request(makeApp())
            .post('/paca/toss/cancel-callback')
            .send({
                orderId: 'PACA-7-1',
                paymentKey: 'pk-ok',
                cancelAmount: 100000,
                cancelReason: '고객 요청',
                canceledAt: '2024-12-20T10:00:00Z'
            });
        expect(res.status).toBe(200);
        expect(res.body.matched).toBe(true);
        expect(res.body.paymentId).toBe(7);
        expect(res.body.refundAmount).toBe(100000);
        expect(res.body.newPaidAmount).toBe(50000); // 150k - 100k
        expect(res.body.newStatus).toBe('partial'); // 50k < 200k
        expect(res.body.remainingAmount).toBe(150000);
        expect(conn.execute.mock.calls[2][0]).toMatch(/UPDATE student_payments/);
        expect(conn.execute.mock.calls[3][0]).toMatch(/UPDATE toss_payment_history/);
        expect(conn.commit).toHaveBeenCalled();
    });

    test('5xx: 한국어 메시지 + rollback', async () => {
        conn.execute.mockReset();
        conn.execute.mockRejectedValueOnce(new Error('DB explosion'));
        const res = await request(makeApp())
            .post('/paca/toss/cancel-callback')
            .send({ orderId: 'X', paymentKey: 'pk', cancelAmount: 1000 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('취소 처리에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB explosion/);
        expect(conn.rollback).toHaveBeenCalled();
    });
});
