/**
 * routes/seasons/crud.js 테스트 (Phase 3 #5).
 *
 * 회귀 보호 범위:
 *   - POST   /paca/seasons        → 201 {message, season}
 *   - PUT    /paca/seasons/:id    → 200 {message, season, scheduleAssignment}
 *   - DELETE /paca/seasons/:id    → 200 {message, season:{id, season_name}}
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003)
 *   - PUT active 전환 시 autoAssignAll 호출 (사이드이펙트 분리 미루기 ADR-015)
 *   - DELETE: 등록 학생 0명일 때만 허용
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
    require('../../../routes/seasons/crud')(router);
    app.use('/paca/seasons', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]); // lesson #206 default
});

describe('POST /paca/seasons', () => {
    test('400: required 필드 누락', async () => {
        const res = await request(makeApp()).post('/paca/seasons').send({ season_name: 'X' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
    });

    test('400: season_type !== early|regular', async () => {
        const res = await request(makeApp()).post('/paca/seasons').send({
            season_name: 'X', season_type: 'invalid',
            season_start_date: '2026-03-01', season_end_date: '2026-08-31',
            non_season_end_date: '2026-02-28', operating_days: ['월']
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/early or regular/);
    });

    test('400: season_monthly_policy 값 오류', async () => {
        const res = await request(makeApp()).post('/paca/seasons').send({
            season_name: 'X', season_type: 'regular',
            season_start_date: '2026-03-01', season_end_date: '2026-08-31',
            non_season_end_date: '2026-02-28', operating_days: ['월'],
            season_monthly_policy: 'academy_global'
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('월납부 처리 방식을 확인해주세요.');
    });

    test('400: non_season_end_date >= season_start_date', async () => {
        const res = await request(makeApp()).post('/paca/seasons').send({
            season_name: 'X', season_type: 'regular',
            season_start_date: '2026-03-01', season_end_date: '2026-08-31',
            non_season_end_date: '2026-03-01', operating_days: ['월']
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/non_season_end_date must be before/);
    });

    test('201: 응답 표면 {message, season} + ADR-005', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([{ insertId: 42 }]); // INSERT
        pool.execute.mockResolvedValueOnce([[{ id: 42, season_name: 'X' }]]); // SELECT
        const res = await request(makeApp()).post('/paca/seasons').send({
            season_name: 'X', season_type: 'regular',
            season_start_date: '2026-03-01', season_end_date: '2026-08-31',
            non_season_end_date: '2026-02-28', operating_days: ['월'],
            season_monthly_policy: 'season_plus_monthly'
        });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Season created successfully');
        expect(res.body.season.id).toBe(42);
        expect(pool.execute.mock.calls[0][0]).toMatch(/INSERT INTO seasons/);
        expect(pool.execute.mock.calls[0][0]).toContain('season_monthly_policy');
        expect(pool.execute.mock.calls[0][1]).toContain('season_plus_monthly');
        const placeholderCount = (pool.execute.mock.calls[0][0].match(/\?/g) || []).length;
        expect(placeholderCount).toBe(pool.execute.mock.calls[0][1].length);
    });

    test('5xx: 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB error xyz'));
        const res = await request(makeApp()).post('/paca/seasons').send({
            season_name: 'X', season_type: 'regular',
            season_start_date: '2026-03-01', season_end_date: '2026-08-31',
            non_season_end_date: '2026-02-28', operating_days: ['월']
        });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 생성에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB error xyz/);
    });
});

describe('PUT /paca/seasons/:id', () => {
    test('404: 미존재 시즌', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).put('/paca/seasons/999').send({ season_name: 'New' });
        expect(res.status).toBe(404);
    });

    test('400: updates 0건', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, status: 'upcoming' }]]);
        const res = await request(makeApp()).put('/paca/seasons/5').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('No fields to update');
    });

    test('400: season_monthly_policy 값 오류', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, status: 'upcoming' }]]);
        const res = await request(makeApp()).put('/paca/seasons/5').send({
            season_monthly_policy: 'academy_global'
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('월납부 처리 방식을 확인해주세요.');
    });

    test('200: 정상 update + scheduleAssignment=null (status 미변경)', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, status: 'upcoming' }]]); // 조회
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);              // UPDATE
        pool.execute.mockResolvedValueOnce([[{ id: 5, season_name: 'New' }]]); // 재조회
        const res = await request(makeApp()).put('/paca/seasons/5').send({
            season_name: 'New',
            season_monthly_policy: 'season_plus_monthly'
        });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Season updated successfully');
        expect(res.body.season.id).toBe(5);
        expect(res.body.scheduleAssignment).toBeNull();
        expect(pool.execute.mock.calls[1][0]).toContain('season_monthly_policy = ?');
        expect(pool.execute.mock.calls[1][1]).toContain('season_plus_monthly');
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB'));
        const res = await request(makeApp()).put('/paca/seasons/5').send({ season_name: 'New' });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 수정에 실패했습니다.');
    });
});

describe('DELETE /paca/seasons/:id', () => {
    test('404: 미존재 시즌', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).delete('/paca/seasons/999');
        expect(res.status).toBe(404);
    });

    test('400: 등록 학생 > 0', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, season_name: 'X' }]]);
        pool.execute.mockResolvedValueOnce([[{ count: 3 }]]);
        const res = await request(makeApp()).delete('/paca/seasons/5');
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Cannot delete season with 3/);
    });

    test('200: 소프트 삭제 (status=ended) + {message, season:{id, season_name}}', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, season_name: 'X' }]]);
        pool.execute.mockResolvedValueOnce([[{ count: 0 }]]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const res = await request(makeApp()).delete('/paca/seasons/5');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Season deactivated successfully');
        expect(res.body.season).toEqual({ id: 5, season_name: 'X' });
        // 마지막 호출이 status='ended' UPDATE
        const lastCall = pool.execute.mock.calls[pool.execute.mock.calls.length - 1];
        expect(lastCall[0]).toMatch(/UPDATE seasons SET status = 'ended'/);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB'));
        const res = await request(makeApp()).delete('/paca/seasons/5');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 삭제에 실패했습니다.');
    });
});
