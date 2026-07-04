/**
 * exports/students.js — GET /paca/exports/students 회귀 테스트
 */

const request = require('supertest');
const express = require('express');
const ExcelJS = require('exceljs');

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
    require('../../../routes/exports/students')(router);
    app.use('/paca/exports', router);
    return app;
}

describe('GET /paca/exports/students', () => {
    beforeEach(() => {
        pool.execute.mockReset();
    });

    test('200 + xlsx + 파일명 학생명단_YYYYMMDD', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ name: '테스트학원' }]])
            .mockResolvedValueOnce([[
                { id: 1, name: 'enc1', phone: 'enc2', school: '서울고', gender: 'male',
                  grade: 1, enrollment_date: '2026-01-15T00:00:00.000Z',
                  admission_type: 'regular', student_type: 'normal',
                  status: 'active', is_trial: 0 }
            ]]);

        const res = await request(buildApp())
            .get('/paca/exports/students')
            .buffer(true)
            .parse(binaryParser);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
        // 학생명단 UTF-8 encode
        expect(res.headers['content-disposition']).toMatch(/%ED%95%99%EC%83%9D%EB%AA%85%EB%8B%A8/);
        expect(res.headers['content-disposition']).toMatch(/filename="students_\d{8}\.xlsx"/);
        expect(Number(res.headers['content-length'])).toBeGreaterThan(100);
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(100);
        expect(res.body[0]).toBe(0x50);
        expect(res.body[1]).toBe(0x4B);
    });

    test('pool.execute 2건 (ADR-005, academies + students)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ name: 'P-ACA' }]])
            .mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/students');

        expect(pool.execute).toHaveBeenCalledTimes(2);
        expect(pool.execute.mock.calls[0][0]).toMatch(/FROM academies/);
        expect(pool.execute.mock.calls[1][0]).toMatch(/FROM students/);
        expect(pool.execute.mock.calls[1][1]).toEqual([1]);
    });

    test('학생이 없어도 Windows Excel에서 열 수 있는 등록 양식 시트를 생성한다', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ name: '새학원' }]])
            .mockResolvedValueOnce([[]]);

        const res = await request(buildApp())
            .get('/paca/exports/students')
            .buffer(true)
            .parse(binaryParser);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(res.body);

        expect(res.status).toBe(200);
        expect(workbook.worksheets.length).toBeGreaterThan(0);
        expect(workbook.worksheets[0].name).toBe('학생등록양식');
        expect(workbook.worksheets[0].getRow(1).values).toEqual([
            undefined,
            '이름',
            '연락처',
            '학교',
            '성별',
            '학년',
            '등록일',
            '입시유형',
            '상태'
        ]);
        expect(workbook.worksheets[0].model.merges).toEqual([]);
    });

    test('상태 분류 정상 (trial → 체험생, pending → 미등록, withdrawn → 퇴원생)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ name: 'P-ACA' }]])
            .mockResolvedValueOnce([[
                { id: 1, name: 'enc1', status: 'active', is_trial: 0 },
                { id: 2, name: 'enc2', status: 'paused', is_trial: 0 },
                { id: 3, name: 'enc3', status: 'withdrawn', is_trial: 0 },
                { id: 4, name: 'enc4', status: 'active', is_trial: 1 },
                { id: 5, name: 'enc5', status: 'pending', is_trial: 0 }
            ]]);

        const res = await request(buildApp())
            .get('/paca/exports/students')
            .buffer(true)
            .parse(binaryParser);

        expect(res.status).toBe(200);
        // 학생등록양식 + 5개 상태 시트 모두 생성됨
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(res.body);

        expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
            '학생등록양식',
            '재원생',
            '휴원생',
            '퇴원생',
            '체험생',
            '미등록',
        ]);
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(500);
    });

    test('5xx + 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET_DB_ERROR_DO_NOT_LEAK'));

        const res = await request(buildApp()).get('/paca/exports/students');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '학생 명단 엑셀을 생성하지 못했습니다.'
        });
        expect(JSON.stringify(res.body)).not.toMatch(/SECRET_DB_ERROR/);
    });
});
