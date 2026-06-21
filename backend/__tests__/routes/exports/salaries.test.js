/**
 * exports/salaries.js — GET /paca/exports/salaries 회귀 테스트
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
    require('../../../routes/exports/salaries')(router);
    app.use('/paca/exports', router);
    return app;
}

describe('GET /paca/exports/salaries', () => {
    beforeEach(() => {
        pool.execute.mockReset();
    });

    test('200 + xlsx + 파일명 급여명세서', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ name: '테스트학원', phone: '02-1234', address: '서울' }]])
            .mockResolvedValueOnce([[
                { id: 1, year_month: '2026-01', instructor_name: 'enc1',
                  resident_number: 'enc2', base_amount: 2000000, incentive_amount: 100000,
                  total_deduction: 50000, tax_type: '3.3', tax_amount: 60000,
                  insurance_details: null, net_salary: 1990000,
                  payment_date: '2026-01-25', payment_status: 'paid' }
            ]]);

        const res = await request(buildApp())
            .get('/paca/exports/salaries?year=2026&month=1')
            .buffer(true)
            .parse(binaryParser);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
        // 급여명세서 UTF-8 encode
        expect(res.headers['content-disposition']).toMatch(/%EA%B8%89%EC%97%AC%EB%AA%85%EC%84%B8%EC%84%9C/);
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(100);
    });

    test('pool.execute 2건 (ADR-005, academies + salary_records JOIN instructors)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ name: 'P-ACA', phone: '', address: '' }]])
            .mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/salaries');

        expect(pool.execute).toHaveBeenCalledTimes(2);
        expect(pool.execute.mock.calls[0][0]).toMatch(/FROM academies/);
        expect(pool.execute.mock.calls[1][0]).toMatch(/FROM salary_records s/);
        expect(pool.execute.mock.calls[1][0]).toMatch(/JOIN instructors i/);
    });

    test('payment_status=paid → statusFilter 적용', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ name: 'P-ACA', phone: '', address: '' }]])
            .mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/salaries?payment_status=paid');

        expect(pool.execute.mock.calls[1][0]).toMatch(/s\.payment_status = 'paid'/);
    });

    test('5xx + 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET_DB_ERROR_DO_NOT_LEAK'));

        const res = await request(buildApp()).get('/paca/exports/salaries');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '급여 내역 엑셀을 생성하지 못했습니다.'
        });
        expect(JSON.stringify(res.body)).not.toMatch(/SECRET_DB_ERROR/);
    });
});
