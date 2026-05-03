/**
 * routes/payments/stats.js 테스트 (Phase 3 #6).
 *
 * 회귀 보호 범위:
 *   - GET /paca/payments/stats/summary → { message, stats }
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003)
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

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/payments/stats')(router);
    app.use('/paca/payments', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[{}]]);
});

describe('GET /paca/payments/stats/summary', () => {
    test('200: 전체 통계 (year/month 미지정)', async () => {
        pool.execute.mockResolvedValueOnce([[{
            total_count: 100,
            paid_count: 50,
            partial_count: 10,
            unpaid_count: 40,
            total_expected: 30000000,
            total_collected: 15000000,
            total_outstanding: 15000000,
        }]]);
        const res = await request(makeApp()).get('/paca/payments/stats/summary');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('납부 통계를 불러왔습니다.');
        expect(res.body.stats.total_count).toBe(100);
        expect(res.body.stats.total_collected).toBe(15000000);

        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).not.toContain('AND p.year_month = ?');
        expect(params).toEqual([5]);
    });

    test('200: year+month 지정 시 dateFilter 적용', async () => {
        await request(makeApp()).get('/paca/payments/stats/summary?year=2026&month=5');
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toContain('AND p.year_month = ?');
        expect(params).toEqual([5, '2026-05']);
    });

    test('500: 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Stats SQL fail'));
        const res = await request(makeApp()).get('/paca/payments/stats/summary');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBe('납부 통계를 불러오는데 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('Stats SQL fail');
    });
});
