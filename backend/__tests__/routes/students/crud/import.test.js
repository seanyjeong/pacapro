const express = require('express');
const request = require('supertest');
const ExcelJS = require('exceljs');

jest.mock('../../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
}));

jest.mock('../../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../../utils/encryption', () => ({
    encrypt: jest.fn((v) => `enc_${v}`),
    decryptFields: jest.fn((row) => row),
    ENCRYPTED_FIELDS: { students: ['name', 'phone', 'parent_phone', 'address'] },
}));

jest.mock('../../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../../../../routes/students/_utils', () => ({
    parseClassDaysWithSlots: jest.fn(() => []),
    extractDayNumbers: jest.fn(() => []),
    autoAssignStudentToSchedules: jest.fn(),
    reassignStudentSchedules: jest.fn(),
    truncateToThousands: jest.fn((v) => Math.floor(v / 1000) * 1000),
}));

const pool = require('../../../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../../routes/students/crud/import')(router);
    app.use('/paca/students', router);
    return app;
}

async function buildStudentWorkbook(rows) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('재원생');
    sheet.mergeCells('A1:H1');
    sheet.getCell('A1').value = 'PACA - 재원생 명단';
    sheet.mergeCells('A2:H2');
    sheet.getCell('A2').value = '출력일: 2026. 7. 2.';
    sheet.getRow(4).values = ['No.', '이름', '연락처', '학교', '성별', '학년', '등록일', '입시유형'];
    rows.forEach((row, index) => {
        sheet.getRow(index + 5).values = [
            index + 1,
            row.name,
            row.phone,
            row.school || '',
            row.gender || '',
            row.grade || '',
            row.enrollmentDate || '',
            row.admissionType || '',
        ];
    });
    return workbook.xlsx.writeBuffer();
}

describe('POST /paca/students/import', () => {
    beforeEach(() => {
        pool.execute.mockReset();
    });

    test('다운로드 양식 xlsx로 신규 학생을 일괄 등록한다', async () => {
        const buffer = await buildStudentWorkbook([
            {
                name: '홍길동',
                phone: '010-1111-2222',
                school: '서울고',
                gender: '남',
                grade: '고3',
                enrollmentDate: '2026-07-02',
                admissionType: '정시',
            },
            {
                name: '김영희',
                phone: '010-3333-4444',
                school: '부산고',
                gender: '여',
                grade: '고2',
                enrollmentDate: '2026-07-03',
                admissionType: '수시',
            },
        ]);

        pool.execute
            .mockResolvedValueOnce([[{ student_number: '2026007' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 101 }])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 102 }]);

        const res = await request(makeApp())
            .post('/paca/students/import')
            .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            .send(Buffer.from(buffer));

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('학생 엑셀 업로드가 완료되었습니다.');
        expect(res.body.summary).toEqual({
            total: 2,
            created: 2,
            skipped: 0,
            failed: 0,
        });

        const insertCalls = pool.execute.mock.calls.filter(([sql]) => /INSERT INTO students/.test(sql));
        expect(insertCalls).toHaveLength(2);
        expect(insertCalls[0][1]).toEqual(expect.arrayContaining([
            1,
            '2026008',
            'enc_홍길동',
            'male',
            'exam',
            'enc_010-1111-2222',
            '서울고',
            '고3',
            'regular',
            'active',
        ]));
        expect(insertCalls[1][1]).toEqual(expect.arrayContaining(['2026009', 'enc_김영희', 'female', 'early']));
    });

    test('이미 등록된 학생은 내부 오류 없이 건너뛴다', async () => {
        const buffer = await buildStudentWorkbook([
            { name: '홍길동', phone: '010-1111-2222' },
        ]);

        pool.execute
            .mockResolvedValueOnce([[{ student_number: '2026007' }]])
            .mockResolvedValueOnce([[{ id: 99 }]]);

        const res = await request(makeApp())
            .post('/paca/students/import')
            .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            .send(Buffer.from(buffer));

        expect(res.status).toBe(200);
        expect(res.body.summary).toEqual({
            total: 1,
            created: 0,
            skipped: 1,
            failed: 0,
        });
        expect(pool.execute.mock.calls.some(([sql]) => /INSERT INTO students/.test(sql))).toBe(false);
    });

    test('깨진 파일은 한국어 오류만 반환하고 내부 오류를 노출하지 않는다', async () => {
        const res = await request(makeApp())
            .post('/paca/students/import')
            .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            .send(Buffer.from('BROKEN_XLSX'));

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            error: 'Invalid Excel File',
            message: '엑셀 파일을 읽지 못했습니다. 학생명단 엑셀 양식인지 확인해주세요.',
        });
        expect(JSON.stringify(res.body)).not.toMatch(/BROKEN|zip|ExcelJS/i);
    });
});
