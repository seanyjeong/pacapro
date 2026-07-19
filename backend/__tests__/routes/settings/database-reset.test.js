jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 5, id: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../config/database', () => ({
    getConnection: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const db = require('../../../config/database');
const logger = require('../../../utils/logger');

const connection = {
    beginTransaction: jest.fn(),
    execute: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
};

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/settings/database-reset')(router);
    app.use('/paca/settings', router);
    return app;
}

beforeEach(() => {
    Object.values(connection).forEach((mock) => mock.mockReset());
    connection.execute.mockResolvedValue([{ affectedRows: 1 }]);
    db.getConnection.mockReset();
    db.getConnection.mockResolvedValue(connection);
    logger.info.mockReset();
    logger.warn.mockReset();
    logger.error.mockReset();
});

describe('POST /paca/settings/reset-database', () => {
    test('로그인한 사용자의 아카데미 데이터만 삭제', async () => {
        const response = await request(makeApp())
            .post('/paca/settings/reset-database')
            .send({ confirmation: '초기화' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('해당 아카데미 데이터가 초기화되었습니다.');
        expect(connection.execute).toHaveBeenCalled();
        for (const [sql, params] of connection.execute.mock.calls) {
            expect(sql).not.toMatch(/TRUNCATE/i);
            expect(sql).toMatch(/academy_id\s*=\s*\?/i);
            expect(params).toEqual([5]);
        }
        expect(connection.commit).toHaveBeenCalledTimes(1);
    });

    test('확인 문자열이 다르면 데이터를 변경하지 않고 한국어로 안내', async () => {
        const response = await request(makeApp())
            .post('/paca/settings/reset-database')
            .send({ confirmation: '잘못된 입력' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('확인을 위해 "초기화"를 입력해주세요.');
        expect(db.getConnection).not.toHaveBeenCalled();
    });

    test('삭제 중 문제가 생기면 전체 작업을 취소하고 안전한 한국어로 안내', async () => {
        connection.execute.mockRejectedValueOnce(new Error('database failed'));

        const response = await request(makeApp())
            .post('/paca/settings/reset-database')
            .send({ confirmation: '초기화' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('데이터를 초기화하지 못했습니다. 기존 데이터는 그대로 유지됩니다.');
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.release).toHaveBeenCalledTimes(1);
    });
});
