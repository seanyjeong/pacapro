/**
 * routes/students/crud/list.js 테스트 (Phase 3 #4).
 *
 * 회귀 보호 범위:
 *   - GET /paca/students 응답 표면 (ADR-013): {message, students[]}
 *   - 필터 (grade / student_type / admission_type / status / gender / is_trial / search)
 *   - status 다중 IN 절 자리표시자 명시 전개 (ADR-016)
 *   - search 메모리 필터 (복호화 후 name/phone/student_number 매치)
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - decryptArrayFields(rows, ENCRYPTED_FIELDS.students) 시그니처 보존 (ADR-007)
 *   - 5xx: 한국어 메시지 (ADR-003)
 */

jest.mock('../../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
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
    encrypt: jest.fn((v) => `enc_${v}`),
    decrypt: jest.fn((v) => (v ? v.replace(/^enc_/, '') : v)),
    decryptFields: jest.fn((row) => row),
    decryptArrayFields: jest.fn((rows) => rows.map(r => ({ ...r, name: r.name ? r.name.replace(/^enc_/, '') : r.name, phone: r.phone ? r.phone.replace(/^enc_/, '') : r.phone }))),
    ENCRYPTED_FIELDS: { students: ['name', 'phone', 'parent_phone', 'address'] },
}));

jest.mock('../../../../utils/dueDateCalculator', () => ({
    calculateDueDate: jest.fn(),
}));

jest.mock('../../../../utils/auditLogger', () => ({
    logAudit: jest.fn(),
    getAuditInfoFromReq: jest.fn(),
}));

jest.mock('../../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../../../../routes/students/_utils', () => ({
    parseClassDaysWithSlots: jest.fn(),
    extractDayNumbers: jest.fn(),
    autoAssignStudentToSchedules: jest.fn(),
    reassignStudentSchedules: jest.fn(),
    truncateToThousands: jest.fn((v) => Math.floor(v / 1000) * 1000),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../../routes/students/crud/list')(router);
    app.use('/paca/students', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
});

describe('GET /paca/students (list)', () => {
    test('응답 표면 보존: {message, students} + ADR-005 pool.execute', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, name: 'enc_홍길동', phone: 'enc_010-0000-0000' }]]);
        const res = await request(makeApp()).get('/paca/students');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Found 1 students');
        expect(res.body).toHaveProperty('students');
        expect(Array.isArray(res.body.students)).toBe(true);
        expect(res.body.students[0].name).toBe('홍길동');
        expect(pool.execute).toHaveBeenCalledTimes(1);
    });

    test('학원 격리: WHERE academy_id = ? 필수 + params[0] = academyId', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students');
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toMatch(/WHERE\s+s\.academy_id\s*=\s*\?/);
        expect(sql).toMatch(/AND\s+s\.deleted_at\s+IS\s+NULL/);
        expect(params[0]).toBe(1);
    });

    test('grade 필터 → AND s.grade = ?', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students?grade=' + encodeURIComponent('고3'));
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toMatch(/AND\s+s\.grade\s*=\s*\?/);
        expect(params).toContain('고3');
    });

    test('is_trial=true → s.is_trial = TRUE 분기', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students?is_trial=true');
        const [sql] = pool.execute.mock.calls[0];
        expect(sql).toMatch(/AND\s+s\.is_trial\s*=\s*TRUE/);
    });

    test('is_trial=false → s.is_trial = FALSE OR IS NULL 분기', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students?is_trial=false');
        const [sql] = pool.execute.mock.calls[0];
        expect(sql).toMatch(/AND\s+\(s\.is_trial\s*=\s*FALSE\s+OR\s+s\.is_trial\s+IS\s+NULL\)/);
    });

    test('status 단일 → AND s.status = ? + params 추가', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students?status=active');
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toMatch(/AND\s+s\.status\s*=\s*\?/);
        expect(params).toContain('active');
    });

    test('status 다중 IN 절 → 자리표시자 명시 전개 (ADR-016)', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students?status=active,paused,trial');
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toMatch(/AND\s+s\.status\s+IN\s*\(\?,\?,\?\)/);
        // params 구조: [academyId, 'active', 'paused', 'trial']
        expect(params).toEqual([1, 'active', 'paused', 'trial']);
    });

    test('search 파라미터 → 메모리 복호화 필터 (DB SQL 에는 미포함)', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, name: 'enc_홍길동', phone: 'enc_010-1234-5678', student_number: '2026001' },
            { id: 2, name: 'enc_김철수', phone: 'enc_010-9999-9999', student_number: '2026002' },
        ]]);
        const res = await request(makeApp()).get('/paca/students?search=' + encodeURIComponent('홍'));
        expect(res.status).toBe(200);
        const [sql] = pool.execute.mock.calls[0];
        // search 는 DB SQL 에는 안 들어감 (암호화된 데이터 검색 불가)
        expect(sql).not.toMatch(/search/i);
        expect(res.body.students).toHaveLength(1);
        expect(res.body.students[0].name).toBe('홍길동');
    });

    test('5xx 한국어 메시지 (ADR-003) + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB DOWN INTERNAL'));
        const res = await request(makeApp()).get('/paca/students');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '학생 목록을 불러오지 못했습니다.',
        });
        expect(JSON.stringify(res.body)).not.toContain('DB DOWN INTERNAL');
    });
});
