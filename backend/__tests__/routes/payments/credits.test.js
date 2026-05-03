/**
 * routes/payments/credits.js 테스트 (Phase 3 #6).
 *
 * 회귀 보호 범위:
 *   - GET /paca/payments/credits         → { credits, stats }
 *   - GET /paca/payments/credits/summary → { students_with_credit, type_stats }
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - 응답 표면 보존 (ADR-013)
 *   - ADR-007: decrypt 시그니처 무변경
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

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/payments/credits')(router);
    app.use('/paca/payments', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
});

describe('GET /paca/payments/credits', () => {
    test('200: { credits, stats } + 학생 이름 복호화 + stats fallback', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 1, student_id: 7, student_name: 'enc_홍길동', credit_amount: 100000, remaining_amount: 50000, status: 'partial', credit_type: 'carryover' },
            ]])
            .mockResolvedValueOnce([[
                { total_count: 1, total_credit: 100000, total_remaining: 50000, pending_count: 0, pending_amount: 0, partial_count: 1, applied_count: 0 },
            ]]);
        const res = await request(makeApp()).get('/paca/payments/credits');
        expect(res.status).toBe(200);
        expect(res.body.credits).toHaveLength(1);
        expect(res.body.credits[0].student_name).toBe('홍길동');
        expect(res.body.stats.total_count).toBe(1);
        expect(res.body.stats.total_remaining).toBe(50000);
    });

    test('200: stats 빈 배열 → fallback (0 채움)', async () => {
        pool.execute
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/payments/credits');
        expect(res.status).toBe(200);
        expect(res.body.stats).toEqual({
            total_count: 0,
            total_credit: 0,
            total_remaining: 0,
            pending_count: 0,
            pending_amount: 0,
            partial_count: 0,
            applied_count: 0,
        });
    });

    test('필터: status + credit_type 적용 (all 은 무시)', async () => {
        await request(makeApp()).get('/paca/payments/credits?status=pending&credit_type=manual');
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toContain('AND rc.status = ?');
        expect(sql).toContain('AND rc.credit_type = ?');
        expect(params).toEqual([5, 'pending', 'manual']);

        pool.execute.mockReset();
        pool.execute.mockResolvedValue([[]]);
        await request(makeApp()).get('/paca/payments/credits?status=all&credit_type=all');
        const [sql2, params2] = pool.execute.mock.calls[0];
        expect(sql2).not.toContain('AND rc.status = ?');
        expect(sql2).not.toContain('AND rc.credit_type = ?');
        expect(params2).toEqual([5]);
    });

    test('500: 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SQL fail'));
        const res = await request(makeApp()).get('/paca/payments/credits');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBe('크레딧 목록 조회에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('SQL fail');
    });
});

describe('GET /paca/payments/credits/summary', () => {
    test('200: { students_with_credit, type_stats } + 학생 이름 복호화', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍길동', student_status: 'active', total_remaining: 50000, credit_count: 2 },
            ]])
            .mockResolvedValueOnce([[
                { credit_type: 'carryover', count: 5, total_amount: 500000, remaining_amount: 200000 },
            ]]);
        const res = await request(makeApp()).get('/paca/payments/credits/summary');
        expect(res.status).toBe(200);
        expect(res.body.students_with_credit).toHaveLength(1);
        expect(res.body.students_with_credit[0].name).toBe('홍길동');
        expect(res.body.type_stats[0].credit_type).toBe('carryover');
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('connection lost'));
        const res = await request(makeApp()).get('/paca/payments/credits/summary');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('크레딧 요약 조회에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('connection lost');
    });
});
