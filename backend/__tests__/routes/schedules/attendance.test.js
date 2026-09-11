/**
 * routes/schedules/attendance.js 테스트 (Phase 3 #7).
 *
 * 회귀 보호 범위:
 *   - GET  /:id/attendance → 미존재 404 / 정상 {message, schedule, season, students[]}
 *   - POST /:id/attendance → 검증 / 미존재 / 트랜잭션 / 5xx + rollback
 *   - 응답 표면 보존 (ADR-013)
 *   - 5xx 한국어 메시지 (ADR-003)
 */

jest.mock('../../../config/database', () => {
    const fakeConn = {
        query: jest.fn(),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
    };
    return {
        execute: jest.fn(),
        query: jest.fn(),
        getConnection: jest.fn(() => Promise.resolve(fakeConn)),
        __conn: fakeConn,
    };
});

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, id: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => v),
}));

jest.mock('../../../utils/attendanceValidator', () => ({
    validateAttendance: jest.fn(),
}));

jest.mock('../../../utils/salaryCalculator', () => ({
    updateSalaryFromAttendance: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../../../utils/attendanceNotify', () => ({
    cancelQueuedAttendanceNotify: jest.fn().mockResolvedValue(),
    notifyAttendance: jest.fn().mockResolvedValue(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const fakeConn = pool.__conn;

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/schedules/attendance')(router);
    require('../../../routes/schedules/attendance-submit')(router);
    app.use('/paca/schedules', router);
    return app;
}

beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockResolvedValue([[]]);
    fakeConn.query.mockReset();
    fakeConn.query.mockResolvedValue([[]]);
    fakeConn.beginTransaction.mockReset().mockResolvedValue();
    fakeConn.commit.mockReset().mockResolvedValue();
    fakeConn.rollback.mockReset().mockResolvedValue();
    fakeConn.release.mockReset();
});

describe('GET /paca/schedules/:id/attendance', () => {
    test('미존재 → 404 한국어', async () => {
        pool.query.mockResolvedValueOnce([[]]); // schedules
        const res = await request(makeApp()).get('/paca/schedules/1/attendance');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('수업을 찾을 수 없습니다.');
    });

    test('정상 (시즌 없음, 정규 학생만, 보충 0명) → {schedule, season:null, students[]}', async () => {
        pool.query.mockReset();
        // 1. schedule
        pool.query.mockResolvedValueOnce([[{
            id: 1, class_date: '2026-01-15', time_slot: 'evening',
            title: 'Test', attendance_taken: 0, instructor_name: 'enc-i'
        }]]);
        // 2. activeSeasons (none)
        pool.query.mockResolvedValueOnce([[]]);
        // 3. regularStudents
        pool.query.mockResolvedValueOnce([[{
            student_id: 10, student_name: 'enc-s', student_number: 's10',
            student_type: 'normal', is_trial: 0, grade: '고1',
            attendance_status: null, makeup_date: null, attendance_notes: null
        }]]);
        // 4. makeupStudents (none)
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/schedules/1/attendance');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('schedule');
        expect(res.body.season).toBeNull();
        expect(res.body.students.length).toBe(1);
        expect(res.body.students[0].student_id).toBe(10);
    });

    test('5xx 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/schedules/1/attendance');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('출석 정보를 불러오지 못했습니다.');
    });
});

describe('POST /paca/schedules/:id/attendance', () => {
    test('빈 배열 → 400 한국어 + connection.release 호출', async () => {
        const res = await request(makeApp())
            .post('/paca/schedules/1/attendance')
            .send({ attendance_records: [] });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('attendance_records 는 비어있지 않은 배열이어야 합니다.');
        expect(fakeConn.release).toHaveBeenCalled();
    });

    test('스케줄 미존재 → 404 한국어 + release', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([[]]); // schedules empty
        const res = await request(makeApp())
            .post('/paca/schedules/1/attendance')
            .send({ attendance_records: [{ student_id: 5, attendance_status: 'present' }] });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('수업을 찾을 수 없습니다.');
        expect(fakeConn.release).toHaveBeenCalled();
    });

    test('정상 (1명 present, 비체험생) → 200 + 트랜잭션 commit + release', async () => {
        fakeConn.query.mockReset();
        // 1. schedules check
        fakeConn.query.mockResolvedValueOnce([[{ id: 1, class_date: '2026-01-15', time_slot: 'evening' }]]);
        // 2. students FOR UPDATE
        fakeConn.query.mockResolvedValueOnce([[{ id: 5, name: 'enc-s', is_trial: 0, trial_remaining: 0, trial_dates: null }]]);
        // 3. existingAttendance
        fakeConn.query.mockResolvedValueOnce([[]]);
        // 4. UPSERT attendance
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        // 5. UPDATE class_schedules attendance_taken
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const res = await request(makeApp())
            .post('/paca/schedules/1/attendance')
            .send({ attendance_records: [{ student_id: 5, attendance_status: 'present' }] });
        expect(res.status).toBe(200);
        expect(fakeConn.beginTransaction).toHaveBeenCalled();
        expect(fakeConn.commit).toHaveBeenCalled();
        expect(fakeConn.release).toHaveBeenCalled();
        expect(res.body.attendance_records.length).toBe(1);
    });

    test('지난 마지막 체험 출석 취소 → 체험 상태로 되살리지 않고 미등록 유지', async () => {
        fakeConn.query.mockReset();
        fakeConn.query
            .mockResolvedValueOnce([[
                { id: 1, class_date: '2026-08-24', time_slot: 'evening' },
            ]])
            .mockResolvedValueOnce([[
                {
                    id: 5,
                    academy_id: 1,
                    name: 'enc-s',
                    is_trial: 0,
                    trial_remaining: 0,
                    status: 'pending',
                    trial_dates: JSON.stringify([
                        { date: '2026-08-24', time_slot: 'evening', attended: true },
                    ]),
                },
            ]])
            .mockResolvedValueOnce([[{ attendance_status: 'present' }]])
            .mockResolvedValue([{ affectedRows: 1 }]);

        const res = await request(makeApp())
            .post('/paca/schedules/1/attendance')
            .send({ attendance_records: [{ student_id: 5, attendance_status: 'none' }] });

        expect(res.status).toBe(200);
        const restoredToTrial = fakeConn.query.mock.calls.some((call) =>
            /trial_remaining = trial_remaining \+ 1/.test(call[0])
            || (call[0].includes('UPDATE students SET status = ?') && call[1]?.[0] === 'trial')
        );
        expect(restoredToTrial).toBe(false);
        const reconciledUpdate = fakeConn.query.mock.calls.find((call) =>
            /UPDATE students/.test(call[0]) && /trial_remaining = \?/.test(call[0])
        );
        expect(reconciledUpdate?.[1]?.slice(0, 3)).toEqual(['pending', 0, 0]);
    });

    test('잘못된 status → 400 + rollback', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([[{ id: 1, class_date: '2026-01-15', time_slot: 'evening' }]]);
        const res = await request(makeApp())
            .post('/paca/schedules/1/attendance')
            .send({ attendance_records: [{ student_id: 5, attendance_status: 'invalid' }] });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('출석 상태를 다시 선택해주세요.');
        expect(fakeConn.rollback).toHaveBeenCalled();
        expect(fakeConn.release).toHaveBeenCalled();
    });

    test('5xx 한국어 + rollback + release', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .post('/paca/schedules/1/attendance')
            .send({ attendance_records: [{ student_id: 5, attendance_status: 'present' }] });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('출석 기록에 실패했습니다.');
        expect(fakeConn.rollback).toHaveBeenCalled();
        expect(fakeConn.release).toHaveBeenCalled();
    });
});


describe('개별 출결 정정', () => {
    test.each(['present', 'none'])('%s: 반 마감과 발송 없이 한 학생만 저장한다', async (status) => {
        const notifications = require('../../../utils/attendanceNotify');
        notifications.notifyAttendance.mockClear();
        fakeConn.query.mockResolvedValueOnce([[{ id: 1, class_date: '2026-09-12', time_slot: 'morning' }]])
            .mockResolvedValueOnce([[{ id: 5, name: '학생', is_trial: 0, trial_remaining: 0, trial_dates: null }]])
            .mockResolvedValueOnce([[{ attendance_status: 'absent' }]])
            .mockResolvedValue([{ affectedRows: 1 }]);
        const res = await request(makeApp()).post('/paca/schedules/1/attendance')
            .send({ mode: 'individual', attendance_records: [{ student_id: 5, attendance_status: status }] });
        await new Promise(setImmediate);
        expect(res.status).toBe(200);
        expect(fakeConn.commit).toHaveBeenCalledTimes(1);
        expect(fakeConn.query.mock.calls.some(([sql]) => sql.includes('UPDATE class_schedules'))).toBe(false);
        expect(notifications.notifyAttendance).not.toHaveBeenCalled();
        if (status === 'none') expect(fakeConn.query.mock.calls.some(([sql]) => sql.includes('makeup_date = NULL'))).toBe(true);
    });
    test('알 수 없는 저장 방식은 변경 전에 거절한다', async () => {
        const res = await request(makeApp()).post('/paca/schedules/1/attendance')
            .send({ mode: 'silent-ish', attendance_records: [{ student_id: 5, attendance_status: 'present' }] });
        expect(res.status).toBe(400);
        expect(fakeConn.query).not.toHaveBeenCalled();
    });
});
