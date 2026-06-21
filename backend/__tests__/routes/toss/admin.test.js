/**
 * routes/toss/admin.js 테스트 (Phase 3 #8).
 *
 * 회귀 보호 범위:
 *   - GET  /paca/toss/history          → {success, total, history}
 *   - GET  /paca/toss/queue            → {success, stats, queue}
 *   - POST /paca/toss/queue/:id/match  → {success, message, paymentId, newStatus, paidAmount}
 *   - POST /paca/toss/queue/:id/ignore → {success, message}
 *   - GET  /paca/toss/stats            → {success, month, paymentStats, queueStats}
 *   - DB 호출: pool.execute / conn.execute (트랜잭션, ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - 응답 표면 보존 (ADR-013): 프론트 src/lib/api/toss.ts 직접 소비 키 1:1
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
        req.user = { id: 100, academy_id: 5, role: 'owner' };
        next();
    }),
    checkPermission: jest.fn(() => (req, res, next) => next()),
    checkAcademyAccess: jest.fn((req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    encrypt: jest.fn((v) => v),
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
const conn = pool.__conn;

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/toss/admin')(router);
    app.use('/paca/toss', router);
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

describe('GET /paca/toss/history', () => {
    test('200: {success, total, history} + ADR-005 + 학생 이름 복호화', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, payment_id: 7, year_month: '2024-12', student_name: 'enc_홍길동', student_number: 'S001' }
        ]]); // SELECT history
        pool.execute.mockResolvedValueOnce([[{ total: 1 }]]); // SELECT count
        const res = await request(makeApp()).get('/paca/toss/history');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.total).toBe(1);
        expect(Array.isArray(res.body.history)).toBe(true);
        expect(res.body.history[0].student_name).toBe('홍길동');
    });

    test('필터: payment_id + start_date + end_date → params append', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        pool.execute.mockResolvedValueOnce([[{ total: 0 }]]);
        const res = await request(makeApp())
            .get('/paca/toss/history?payment_id=7&start_date=2024-12-01&end_date=2024-12-31&limit=10&offset=20');
        expect(res.status).toBe(200);
        const sql = pool.execute.mock.calls[0][0];
        expect(sql).toMatch(/AND h\.payment_id = \?/);
        expect(sql).toMatch(/AND h\.approved_at >= \?/);
        expect(sql).toMatch(/AND h\.approved_at <= \?/);
        // LIMIT/OFFSET 은 SQL 인터폴레이트 (lesson #235 — mysql2 prepared statement 호환)
        expect(sql).toMatch(/LIMIT 10 OFFSET 20/);
        expect(pool.execute.mock.calls[0][1]).toEqual([5, '7', '2024-12-01', '2024-12-31 23:59:59']);
    });

    test('5xx: 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB connection lost'));
        const res = await request(makeApp()).get('/paca/toss/history');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('결제 이력 조회에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB connection lost/);
    });
});

describe('GET /paca/toss/queue', () => {
    test('200: {success, stats, queue}', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, order_id: 'O1', payment_key: 'pk1', amount: 1000, match_status: 'pending' }
        ]]); // SELECT queue
        pool.execute.mockResolvedValueOnce([[
            { match_status: 'pending', count: 5, total_amount: 50000 },
            { match_status: 'matched', count: 10, total_amount: 100000 }
        ]]); // SELECT stats
        const res = await request(makeApp()).get('/paca/toss/queue');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.queue.length).toBe(1);
        expect(res.body.stats.pending).toEqual({ count: 5, amount: 50000 });
        expect(res.body.stats.matched).toEqual({ count: 10, amount: 100000 });
    });

    test('5xx: 한국어', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/toss/queue');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('대기열 조회에 실패했습니다.');
    });
});

describe('POST /paca/toss/queue/:id/match', () => {
    test('404: 대기열 미존재', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[]]); // SELECT queue 비어있음
        const res = await request(makeApp())
            .post('/paca/toss/queue/99/match')
            .send({ payment_id: 7 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('대기열 항목을 찾을 수 없습니다.');
        expect(conn.rollback).toHaveBeenCalled();
    });

    test('400: 이미 처리된 항목', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[
            { id: 1, match_status: 'matched', amount: 1000 }
        ]]);
        const res = await request(makeApp())
            .post('/paca/toss/queue/1/match')
            .send({ payment_id: 7 });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('이미 처리된 항목입니다.');
    });

    test('404: 결제 내역 미존재', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[
            { id: 1, match_status: 'pending', amount: 1000 }
        ]]); // queue
        conn.execute.mockResolvedValueOnce([[]]); // student_payments 미존재
        const res = await request(makeApp())
            .post('/paca/toss/queue/1/match')
            .send({ payment_id: 99 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('결제 내역을 찾을 수 없습니다.');
    });

    test('정상 매칭: {success, message, paymentId, newStatus, paidAmount} + 3건 트랜잭션 SQL (lesson #206)', async () => {
        conn.execute.mockReset();
        conn.execute.mockResolvedValueOnce([[
            { id: 1, match_status: 'pending', amount: 100000, order_id: 'O1', payment_key: 'pk1',
              method: 'CARD', approved_at: '2024-12-15', receipt_url: null, card_company: '신한', raw_data: '{}' }
        ]]); // queue
        conn.execute.mockResolvedValueOnce([[
            { id: 7, paid_amount: 50000, final_amount: 200000 }
        ]]); // student_payments
        conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE student_payments
        conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE queue
        conn.execute.mockResolvedValueOnce([{ insertId: 100 }]); // INSERT history
        const res = await request(makeApp())
            .post('/paca/toss/queue/1/match')
            .send({ payment_id: 7 });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.paymentId).toBe(7);
        expect(res.body.newStatus).toBe('partial'); // 150k < 200k
        expect(res.body.paidAmount).toBe(150000);
        expect(res.body.message).toBe('수동 매칭 완료');
        // 핵심 SQL 호출
        expect(conn.execute.mock.calls[2][0]).toMatch(/UPDATE student_payments/);
        expect(conn.execute.mock.calls[3][0]).toMatch(/UPDATE toss_payment_queue[\s\S]+matched/);
        expect(conn.execute.mock.calls[4][0]).toMatch(/INSERT INTO toss_payment_history/);
        expect(conn.commit).toHaveBeenCalled();
    });

    test('5xx: 한국어 + rollback', async () => {
        conn.execute.mockReset();
        conn.execute.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .post('/paca/toss/queue/1/match')
            .send({ payment_id: 7 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('수동 매칭에 실패했습니다.');
        expect(conn.rollback).toHaveBeenCalled();
    });
});

describe('POST /paca/toss/queue/:id/ignore', () => {
    test('404: 학원 소속 검증 실패', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/toss/queue/99/ignore')
            .send({ reason: '테스트' });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('대기열 항목을 찾을 수 없습니다.');
    });

    test('200: {success, message:"무시 처리 완료"} + UPDATE 호출 + reason params 보존', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 1 }]]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const res = await request(makeApp())
            .post('/paca/toss/queue/1/ignore')
            .send({ reason: '관리자 테스트' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('무시 처리 완료');
        // UPDATE 의 params spread 검증
        expect(pool.execute.mock.calls[1][1]).toEqual(['관리자 테스트', 100, 1, 5]);
    });

    test('5xx: 한국어', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .post('/paca/toss/queue/1/ignore')
            .send({});
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('무시 처리에 실패했습니다.');
    });
});

describe('GET /paca/toss/stats', () => {
    test('200: {success, month, paymentStats, queueStats} + 기본 month = 이번 달', async () => {
        pool.execute.mockResolvedValueOnce([[
            { total_count: 3, total_amount: 300000, unique_payments: 3, method: 'CARD', date: '2024-12-15' }
        ]]); // SELECT stats
        pool.execute.mockResolvedValueOnce([[
            { match_status: 'pending', count: 5 },
            { match_status: 'matched', count: 10 }
        ]]); // SELECT queue stats
        const res = await request(makeApp()).get('/paca/toss/stats');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('month');
        expect(res.body.month).toMatch(/^\d{4}-\d{2}$/);
        expect(Array.isArray(res.body.paymentStats)).toBe(true);
        expect(res.body.queueStats).toEqual({ pending: 5, matched: 10 });
    });

    test('year_month query 우선', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/toss/stats?year_month=2024-11');
        expect(res.status).toBe(200);
        expect(res.body.month).toBe('2024-11');
        expect(pool.execute.mock.calls[0][1]).toEqual([5, '2024-11']);
    });

    test('5xx: 한국어', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/toss/stats');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('통계 조회에 실패했습니다.');
    });
});
