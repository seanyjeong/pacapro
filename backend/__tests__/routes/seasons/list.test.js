/**
 * routes/seasons/list.js 테스트 (Phase 3 #5).
 *
 * 회귀 보호 범위:
 *   - GET /paca/seasons          → {message, seasons[]} + 종료일 지난 active 자동 ended UPDATE
 *   - GET /paca/seasons/active   → {message, seasons[]}
 *   - GET /paca/seasons/registerable → {message, seasons[]} (active + upcoming)
 *   - GET /paca/seasons/:id      → {season} (root 키 season 만)
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003)
 *   - 응답 표면 보존 (ADR-013): seasons / season root 키 + enrolled_students 필드
 */

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => v),
}));

jest.mock('../../../utils/seasonCalculator', () => ({
    calculateProRatedFee: jest.fn(),
    calculateSeasonRefund: jest.fn(),
    calculateMidSeasonFee: jest.fn(),
    parseWeeklyDays: jest.fn(),
    previewSeasonTransition: jest.fn(),
    truncateToThousands: jest.fn(),
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
    require('../../../routes/seasons/list')(router);
    app.use('/paca/seasons', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    // lesson #206: default = 빈 배열 → 정상 케이스 호출 시 누락된 mock 으로 인한 5xx 회피
    pool.execute.mockResolvedValue([[]]);
});

describe('GET /paca/seasons (list)', () => {
    test('응답 표면: {message, seasons} + ADR-005 pool.execute + 자동 ended UPDATE 호출', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]); // UPDATE
        pool.execute.mockResolvedValueOnce([[{ id: 1, season_name: 'Test' }]]); // SELECT
        const res = await request(makeApp()).get('/paca/seasons');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Found 1 seasons');
        expect(res.body).toHaveProperty('seasons');
        expect(Array.isArray(res.body.seasons)).toBe(true);
        expect(res.body.seasons.length).toBe(1);
        // 자동 ended UPDATE 가 먼저 호출됨
        expect(pool.execute.mock.calls[0][0]).toMatch(/UPDATE seasons SET status = 'ended'/);
        expect(pool.execute.mock.calls[0][1]).toEqual([1]);
    });

    test('필터: status=active, season_type=regular → params append + AND 절 추가', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/seasons?status=active&season_type=regular');
        expect(res.status).toBe(200);
        // 두번째 SELECT 의 SQL 에 status / season_type 절 모두 포함
        const sql = pool.execute.mock.calls[1][0];
        expect(sql).toMatch(/AND status = \?/);
        expect(sql).toMatch(/AND season_type = \?/);
        expect(pool.execute.mock.calls[1][1]).toEqual([1, 'active', 'regular']);
    });

    test('5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB connection refused'));
        const res = await request(makeApp()).get('/paca/seasons');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 목록을 불러오지 못했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB connection refused/);
    });
});

describe('GET /paca/seasons/active', () => {
    test('응답 표면: {message, seasons} + 수동 active 시즌은 시작 전이어도 반환', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 1, season_name: 'Active' }]]);
        const res = await request(makeApp()).get('/paca/seasons/active');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Found 1 active season(s)');
        expect(res.body.seasons.length).toBe(1);
        const sql = pool.execute.mock.calls[0][0];
        expect(sql).toMatch(/status = 'active'/);
        expect(sql).toMatch(/season_end_date >= \?/);
        expect(sql).not.toMatch(/season_start_date <= \?/);
        expect(pool.execute.mock.calls[0][1]).toHaveLength(2);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB error'));
        const res = await request(makeApp()).get('/paca/seasons/active');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('활성 시즌을 불러오지 못했습니다.');
    });
});

describe('GET /paca/seasons/registerable', () => {
    test('응답 표면: {message, seasons} + active/upcoming만 등록 가능', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
        pool.execute.mockResolvedValueOnce([[{ id: 1, status: 'active' }, { id: 2, status: 'upcoming' }]]);
        const res = await request(makeApp()).get('/paca/seasons/registerable');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Found 2 registerable season(s)');
        expect(res.body.seasons).toHaveLength(2);
        expect(pool.execute.mock.calls[0][0]).toMatch(/UPDATE seasons SET status = 'ended'/);
        const sql = pool.execute.mock.calls[1][0];
        expect(sql).toMatch(/status IN \('active', 'upcoming'\)/);
        expect(pool.execute.mock.calls[1][1]).toEqual([1]);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB error'));
        const res = await request(makeApp()).get('/paca/seasons/registerable');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('등록 가능한 시즌을 불러오지 못했습니다.');
    });
});

describe('GET /paca/seasons/:id', () => {
    test('404: 미존재 시즌', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]); // SELECT 시즌 없음
        const res = await request(makeApp()).get('/paca/seasons/999');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Not Found');
    });

    test('200: {season} root 키 + enrolled_students 필드 추가', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, season_name: 'X' }]]);
        pool.execute.mockResolvedValueOnce([[{ count: 7 }]]);
        const res = await request(makeApp()).get('/paca/seasons/5');
        expect(res.status).toBe(200);
        // root 키 = season (message X)
        expect(res.body).toHaveProperty('season');
        expect(res.body).not.toHaveProperty('message');
        expect(res.body.season.id).toBe(5);
        expect(res.body.season.enrolled_students).toBe(7);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB error'));
        const res = await request(makeApp()).get('/paca/seasons/5');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 정보를 불러오지 못했습니다.');
    });
});
