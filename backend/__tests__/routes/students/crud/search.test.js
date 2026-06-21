/**
 * routes/students/crud/search.js 테스트 (Phase 3 #4).
 *
 * 회귀 보호 범위:
 *   - GET /paca/students/search?q=... 응답 표면 (ADR-013): {message, students[]} (max 20)
 *   - q 누락/빈 → 400 한국어
 *   - DB 호출: pool.execute (ADR-005, status='active' WHERE 고정)
 *   - 메모리 복호화 + 필터 (name/phone/student_number 매치)
 *   - 5xx 한국어 + e.message 누출 0건
 *
 * ⚠️ 본 endpoint 는 students/crud/index.js 의 등록 순서 상 GET /:id 뒤에 등록 → 실제 라우터 마운트 시
 * `/search` 호출이 `:id="search"` 로 잡혀 dead code. 본 테스트는 search.js 단독으로 mount 하여
 * 핸들러 본체 동작만 검증 (lesson #200 — endpoint 카운트는 sub-라우터 단독 검증으로 위임).
 */

jest.mock('../../../../config/database', () => ({
    execute: jest.fn(), query: jest.fn(), getConnection: jest.fn(),
}));

jest.mock('../../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../../utils/encryption', () => ({
    encrypt: jest.fn(),
    decrypt: jest.fn((v) => (v ? v.replace(/^enc_/, '') : v)),
    decryptFields: jest.fn(),
    decryptArrayFields: jest.fn(),
    ENCRYPTED_FIELDS: { students: [] },
}));
jest.mock('../../../../utils/dueDateCalculator', () => ({ calculateDueDate: jest.fn() }));
jest.mock('../../../../utils/auditLogger', () => ({ logAudit: jest.fn(), getAuditInfoFromReq: jest.fn() }));
jest.mock('../../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../../routes/students/_utils', () => ({
    parseClassDaysWithSlots: jest.fn(), extractDayNumbers: jest.fn(),
    autoAssignStudentToSchedules: jest.fn(), reassignStudentSchedules: jest.fn(),
    truncateToThousands: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../../routes/students/crud/search')(router);
    app.use('/paca/students', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
});

describe('GET /paca/students/search', () => {
    test('q 누락 → 400 한국어 (ADR-003)', async () => {
        const res = await request(makeApp()).get('/paca/students/search');
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Validation Error', message: '검색어를 입력해주세요.' });
        expect(pool.execute).not.toHaveBeenCalled();
    });

    test('정상 → {message, students[]} 응답 표면 보존 + 메모리 복호화 필터', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, name: 'enc_홍길동', phone: 'enc_010-1234-5678', student_number: '2026001', grade: '고3' },
            { id: 2, name: 'enc_김철수', phone: 'enc_010-9999-9999', student_number: '2026002', grade: '고2' },
        ]]);
        const res = await request(makeApp()).get('/paca/students/search?q=' + encodeURIComponent('홍'));
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Found 1 students');
        expect(res.body.students).toHaveLength(1);
        expect(res.body.students[0].name).toBe('홍길동');
    });

    test('전체 학생 SELECT — status = active + 학원 격리 (ADR-005)', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students/search?q=' + encodeURIComponent('홍'));
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toMatch(/FROM students/);
        expect(sql).toMatch(/AND\s+status\s*=\s*'active'/);
        expect(sql).toMatch(/WHERE\s+academy_id\s*=\s*\?/);
        expect(params).toEqual([1]);
    });

    test('max 20건 slice', async () => {
        const rows = [];
        for (let i = 0; i < 30; i++) rows.push({ id: i, name: 'enc_홍길동', phone: 'enc_010-1234-5678', student_number: `2026${String(i).padStart(3, '0')}` });
        pool.execute.mockResolvedValueOnce([rows]);
        const res = await request(makeApp()).get('/paca/students/search?q=' + encodeURIComponent('홍'));
        expect(res.status).toBe(200);
        expect(res.body.students).toHaveLength(20);
    });

    test('5xx 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET'));
        const res = await request(makeApp()).get('/paca/students/search?q=' + encodeURIComponent('홍'));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Server Error', message: '학생 검색에 실패했습니다.' });
        expect(JSON.stringify(res.body)).not.toContain('SECRET');
    });
});
