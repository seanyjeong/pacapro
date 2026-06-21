/**
 * exports/financial.js — GET /paca/exports/financial 회귀 테스트
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn()
}));
jest.mock('../../../middleware/auth', () => ({
    verifyToken: (req, res, next) => {
        req.user = { id: 1, academyId: 1, role: 'owner' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
    checkPermission: () => (req, res, next) => next()
}));
jest.mock('../../../utils/encryption', () => ({
    decrypt: (v) => v ? `dec(${v})` : v,
    encrypt: (v) => v
}));
jest.mock('../../../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const pool = require('../../../config/database');

function binaryParser(res, callback) {
    res.setEncoding('binary');
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}

function buildApp() {
    const app = express();
    const router = express.Router();
    require('../../../routes/exports/financial')(router);
    app.use('/paca/exports', router);
    return app;
}

describe('GET /paca/exports/financial', () => {
    beforeEach(() => {
        pool.execute.mockReset();
    });

    test('200 + xlsx + 파일명 재무리포트_YYYY년', async () => {
        pool.execute
            .mockResolvedValueOnce([[]])  // monthlyRevenue
            .mockResolvedValueOnce([[]])  // monthlyOtherIncome
            .mockResolvedValueOnce([[]]); // monthlyExpenses

        const res = await request(buildApp())
            .get('/paca/exports/financial?year=2026')
            .buffer(true)
            .parse(binaryParser);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
        // 재무리포트 UTF-8 encode
        expect(res.headers['content-disposition']).toMatch(/%EC%9E%AC%EB%AC%B4%EB%A6%AC%ED%8F%AC%ED%8A%B8/);
        expect(res.headers['content-disposition']).toContain('2026');
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(100);
    });

    test('pool.execute 3건 (ADR-005, student_payments + other_incomes + expenses)', async () => {
        pool.execute
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/financial?year=2026');

        expect(pool.execute).toHaveBeenCalledTimes(3);
        expect(pool.execute.mock.calls[0][0]).toMatch(/FROM student_payments/);
        expect(pool.execute.mock.calls[1][0]).toMatch(/FROM other_incomes/);
        expect(pool.execute.mock.calls[2][0]).toMatch(/FROM expenses/);
        // 각 호출 params = [academyId, year]
        pool.execute.mock.calls.forEach(call => {
            expect(call[1][0]).toBe(1);  // academyId
            expect(String(call[1][1])).toBe('2026');
        });
    });

    test('year 미지정 시 현재 연도 default', async () => {
        pool.execute
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);

        const res = await request(buildApp())
            .get('/paca/exports/financial')
            .buffer(true)
            .parse(binaryParser);

        const currentYear = String(new Date().getFullYear());
        expect(res.headers['content-disposition']).toContain(currentYear);
    });

    test('5xx + 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET_DB_ERROR_DO_NOT_LEAK'));

        const res = await request(buildApp()).get('/paca/exports/financial?year=2026');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '재무 리포트 엑셀을 생성하지 못했습니다.'
        });
        expect(JSON.stringify(res.body)).not.toMatch(/SECRET_DB_ERROR/);
    });
});
