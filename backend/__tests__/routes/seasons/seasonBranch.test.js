/**
 * 지점별 시즌: seasons.branch_id NULL = 전 지점(지금과 같음).
 * 만들기·수정에 지점(이 학원 지점만), 지점 시즌 학생 등록은 그 지점 학생만.
 */
jest.mock('../../../config/database', () => ({ execute: jest.fn(), query: jest.fn(), getConnection: jest.fn() }));
jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/seasons/crud')(router);
    require('../../../routes/seasons/enroll')(router);
    app.use('/paca/seasons', router);
    return app;
}
const seasonBody = {
    season_name: '수성 정시', season_type: 'regular',
    season_start_date: '2026-12-01', season_end_date: '2027-02-28',
    non_season_end_date: '2026-11-30', operating_days: [1, 3, 5],
    free_lesson_end_date: '2027-02-28', post_free_action: 'regular',
};
const insertCall = () => pool.execute.mock.calls.find(([sql]) => /INSERT INTO seasons/.test(sql));
const branchLookups = () => pool.execute.mock.calls.filter(([sql]) => /FROM branches/.test(sql));

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
});

describe('시즌 만들기·수정의 지점', () => {
    test('지점을 안 주면 전 지점 시즌(branch_id NULL), 지점 확인 쿼리도 없다', async () => {
        pool.execute.mockResolvedValueOnce([{ insertId: 5 }]).mockResolvedValueOnce([[{ id: 5, branch_id: null }]]);
        const res = await request(makeApp()).post('/paca/seasons').send(seasonBody);
        expect(res.status).toBe(201);
        expect(branchLookups()).toHaveLength(0);
        const [sql, params] = insertCall();
        expect(sql).toContain('branch_id');
        expect((sql.match(/\?/g) || []).length).toBe(params.length);
        expect(params[params.length - 1]).toBeNull();
    });

    test('이 학원 지점이면 그 지점 시즌으로 만든다', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 3 }]])
            .mockResolvedValueOnce([{ insertId: 6 }])
            .mockResolvedValueOnce([[{ id: 6, branch_id: 3 }]]);
        const res = await request(makeApp()).post('/paca/seasons').send({ ...seasonBody, branch_id: 3 });
        expect(res.status).toBe(201);
        expect(branchLookups()[0][1]).toEqual([3, 1]);
        expect(insertCall()[1].at(-1)).toBe(3);
        expect(res.body.season.branch_id).toBe(3);
    });

    test('다른 학원 지점이나 잘못된 값은 만들지 않는다', async () => {
        const missing = await request(makeApp()).post('/paca/seasons').send({ ...seasonBody, branch_id: 99 });
        expect(missing.status).toBe(404);
        const bad = await request(makeApp()).post('/paca/seasons').send({ ...seasonBody, branch_id: '3' });
        expect(bad.status).toBe(400);
        expect(insertCall()).toBeUndefined();
    });

    test('수정에서 지점을 바꾸거나 전 지점(null)으로 돌린다', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 6, status: 'upcoming', branch_id: 3 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 6, branch_id: null }]]);
        const res = await request(makeApp()).put('/paca/seasons/6').send({ branch_id: null });
        expect(res.status).toBe(200);
        expect(branchLookups()).toHaveLength(0);
        const update = pool.execute.mock.calls.find(([sql]) => /UPDATE seasons SET/.test(sql));
        expect(update[0]).toContain('branch_id = ?');
        expect(update[1]).toEqual([null, 6]);

        pool.execute.mockReset();
        pool.execute
            .mockResolvedValueOnce([[{ id: 6, status: 'upcoming', branch_id: null }]])
            .mockResolvedValueOnce([[]]);
        expect((await request(makeApp()).put('/paca/seasons/6').send({ branch_id: 77 })).status).toBe(404);
        expect(pool.execute.mock.calls.some(([sql]) => /UPDATE seasons SET/.test(sql))).toBe(false);
    });

    test('지점을 건드리지 않는 수정은 지금과 같은 쿼리', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 6, status: 'upcoming' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 6 }]]);
        await request(makeApp()).put('/paca/seasons/6').send({ season_name: '이름만' });
        const update = pool.execute.mock.calls.find(([sql]) => /UPDATE seasons SET/.test(sql));
        expect(update[0]).not.toContain('branch_id');
        expect(branchLookups()).toHaveLength(0);
    });
});

describe('지점 시즌 학생 등록 후보 범위', () => {
    const enroll = (season, student) => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 6, academy_id: 1, status: 'upcoming', ...season }]])
            .mockResolvedValueOnce([[{ id: 50, academy_id: 1, status: 'active', ...student }]]);
        return request(makeApp()).post('/paca/seasons/6/enroll').send({ student_id: 50, season_fee: 100000 });
    };
    const reachedDuplicateCheck = () => pool.execute.mock.calls.some(([sql]) => /FROM student_seasons/.test(sql));

    test.each([
        ['다른 지점 학생', { branch_id: 3 }, { branch_id: 5 }],
        ['지점 없는 학생', { branch_id: 3 }, { branch_id: null }],
    ])('지점 시즌에 %s은 등록하지 않는다', async (_label, season, student) => {
        const res = await enroll(season, student);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('이 시즌은 다른 지점 시즌입니다. 그 지점 학생만 등록할 수 있습니다.');
        expect(reachedDuplicateCheck()).toBe(false);
    });

    test.each([
        ['지점 시즌에 그 지점 학생', { branch_id: 3 }, { branch_id: 3 }],
        ['전 지점 시즌에 어느 지점 학생', { branch_id: null }, { branch_id: 5 }],
        ['지점 칸이 없는(지점 안 쓰는) 학원', {}, {}],
    ])('%s은 지금처럼 등록 절차로 간다', async (_label, season, student) => {
        const res = await enroll(season, student);
        expect(res.body.message).not.toBe('이 시즌은 다른 지점 시즌입니다. 그 지점 학생만 등록할 수 있습니다.');
        expect(reachedDuplicateCheck()).toBe(true);
    });
});
