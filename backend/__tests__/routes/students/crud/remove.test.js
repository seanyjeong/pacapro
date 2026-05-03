/**
 * routes/students/crud/remove.js 테스트 (Phase 3 #4).
 *
 * 회귀 보호 범위:
 *   - DELETE /paca/students/:id 응답 표면 (ADR-013): {message, student:{id, name}}
 *   - 학생 미존재 → 404 한국어
 *   - 트랜잭션: pool.getConnection + beginTransaction + 6 cascade DELETE + students DELETE + commit
 *   - 트랜잭션 에러 → rollback + 5xx 한국어 + e.message 누출 0건 (detail root key 제거)
 *   - cascade 테이블 화이트리스트 (attendance / student_payments / student_performance / student_seasons /
 *     rest_credits / notification_logs) 6건 + students 1건 = 7 conn.execute 호출
 *   - 개별 cascade DELETE 실패는 무시 (테이블 없거나 컬럼 없는 경우)
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
    encrypt: jest.fn(), decrypt: jest.fn(), decryptFields: jest.fn(), decryptArrayFields: jest.fn(),
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
    require('../../../../routes/students/crud/remove')(router);
    app.use('/paca/students', router);
    return app;
}

function makeFakeConn() {
    return {
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
    };
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.getConnection.mockReset();
});

describe('DELETE /paca/students/:id (remove)', () => {
    test('학생 미존재 → 404 한국어 (트랜잭션 시작 X)', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // students 빈 배열
        const res = await request(makeApp()).delete('/paca/students/999');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found', message: '학생 정보를 찾을 수 없습니다.' });
        expect(pool.getConnection).not.toHaveBeenCalled();
    });

    test('정상 삭제 → {message, student:{id, name}} 응답 표면 보존', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 5, name: '홍길동' }]]);
        const fakeConn = makeFakeConn();
        pool.getConnection.mockResolvedValueOnce(fakeConn);
        const res = await request(makeApp()).delete('/paca/students/5');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'Student deleted permanently',
            student: { id: 5, name: '홍길동' },
        });
        expect(fakeConn.beginTransaction).toHaveBeenCalledTimes(1);
        expect(fakeConn.commit).toHaveBeenCalledTimes(1);
        expect(fakeConn.rollback).not.toHaveBeenCalled();
        expect(fakeConn.release).toHaveBeenCalledTimes(1);
    });

    test('cascade DELETE 7건 (6 화이트리스트 + students)', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 5, name: '홍길동' }]]);
        const fakeConn = makeFakeConn();
        pool.getConnection.mockResolvedValueOnce(fakeConn);
        await request(makeApp()).delete('/paca/students/5');
        expect(fakeConn.execute).toHaveBeenCalledTimes(7);
        const sqls = fakeConn.execute.mock.calls.map(c => c[0]);
        expect(sqls.some(s => s.includes('DELETE FROM attendance'))).toBe(true);
        expect(sqls.some(s => s.includes('DELETE FROM student_payments'))).toBe(true);
        expect(sqls.some(s => s.includes('DELETE FROM student_performance'))).toBe(true);
        expect(sqls.some(s => s.includes('DELETE FROM student_seasons'))).toBe(true);
        expect(sqls.some(s => s.includes('DELETE FROM rest_credits'))).toBe(true);
        expect(sqls.some(s => s.includes('DELETE FROM notification_logs'))).toBe(true);
        expect(sqls.some(s => s.includes('DELETE FROM students WHERE id'))).toBe(true);
        // 모든 cascade 호출이 student_id = ? 자리표시자 + studentId binding
        for (const call of fakeConn.execute.mock.calls.slice(0, 6)) {
            expect(call[1]).toEqual([5]);
        }
    });

    test('개별 cascade 실패 무시 — 한 테이블 throw 해도 다른 6건 계속 + commit', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 5, name: '홍길동' }]]);
        const fakeConn = makeFakeConn();
        // 첫 번째 cascade (attendance) 만 실패
        fakeConn.execute
            .mockRejectedValueOnce(new Error('table not found'))
            .mockResolvedValue([{ affectedRows: 1 }]);
        pool.getConnection.mockResolvedValueOnce(fakeConn);
        const res = await request(makeApp()).delete('/paca/students/5');
        expect(res.status).toBe(200);
        expect(fakeConn.commit).toHaveBeenCalledTimes(1);
        expect(fakeConn.rollback).not.toHaveBeenCalled();
    });

    test('students DELETE 실패 → rollback + 5xx 한국어 + detail root key 제거 + e.message 누출 0건', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 5, name: '홍길동' }]]);
        const fakeConn = makeFakeConn();
        // 6 cascade 성공, 마지막 students DELETE 실패
        fakeConn.execute = jest.fn();
        for (let i = 0; i < 6; i++) {
            fakeConn.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        }
        const fkError = new Error('FK CONSTRAINT INTERNAL');
        fkError.sqlMessage = 'a foreign key constraint fails';
        fakeConn.execute.mockRejectedValueOnce(fkError);
        pool.getConnection.mockResolvedValueOnce(fakeConn);
        const res = await request(makeApp()).delete('/paca/students/5');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '학생 삭제에 실패했습니다.',
        });
        expect(res.body).not.toHaveProperty('detail');
        expect(JSON.stringify(res.body)).not.toContain('FK CONSTRAINT INTERNAL');
        expect(JSON.stringify(res.body)).not.toContain('foreign key constraint');
        expect(fakeConn.rollback).toHaveBeenCalledTimes(1);
        expect(fakeConn.release).toHaveBeenCalledTimes(1);
    });

    test('SELECT 단계 throw → 트랜잭션 시작 X + 5xx 한국어', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB DOWN'));
        const res = await request(makeApp()).delete('/paca/students/5');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('학생 삭제에 실패했습니다.');
        expect(pool.getConnection).not.toHaveBeenCalled();
        expect(JSON.stringify(res.body)).not.toContain('DB DOWN');
    });
});
