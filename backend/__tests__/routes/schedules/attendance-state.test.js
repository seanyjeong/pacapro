jest.mock('../../../config/database', () => ({ query: jest.fn() }));
jest.mock('../../../middleware/auth', () => ({ verifyToken: (req, res, next) => {
    req.user = { academyId: 7 }; next();
} }));
jest.mock('../../../utils/encryption', () => ({ decrypt: (v) => v.replace('enc_', '') }));
jest.mock('../../../utils/logger', () => ({ error: jest.fn() }));
const request = require('supertest');
const express = require('express');
const db = require('../../../config/database');
const { getAttendanceState } = require('../../../services/attendanceStateService');

function app() {
    const value = express();
    const router = express.Router();
    require('../../../routes/schedules/attendance-state')(router);
    value.use('/paca/schedules', router);
    return value;
}
beforeEach(() => db.query.mockReset());

test('pure SELECT returns actual moved/trial/makeup rows and unchecked eligible students', async () => {
    db.query.mockResolvedValueOnce([[{ id: 71, class_date: '2026-09-12', time_slot: 'morning', attendance_taken: 0 }]])
        .mockResolvedValueOnce([[
            { student_id: 3, student_name: 'enc_이동학생', attendance_status: 'late', notes: '실제 메모' },
            { student_id: 2, student_name: 'enc_체험학생', attendance_status: null, is_trial: 1, is_makeup: 1 },
            { student_id: 1, student_name: 'enc_정규학생', attendance_status: 'makeup', makeup_date: '2026-09-14' },
        ]]).mockResolvedValueOnce([[
            { student_id: 1, student_name: 'enc_정규학생' },
            { student_id: 4, student_name: 'enc_미확인학생' },
        ]]);
    const response = await request(app()).get('/paca/schedules/71/attendance-state');
    expect(response.status).toBe(200);
    expect(response.body.capabilities.individualAttendance).toBe(true);
    expect(response.body.students.map((row) => [row.student_id, row.attendance_status]))
        .toEqual([[1, 'makeup'], [2, null], [3, 'late'], [4, null]]);
    expect(response.body.students[2].notes).toBe('실제 메모');
    expect(response.body.students[3].student_name).toBe('미확인학생');
    expect(db.query).toHaveBeenCalledTimes(3);
    for (const [sql] of db.query.mock.calls) expect(sql.trim()).toMatch(/^SELECT /);
    expect(db.query.mock.calls[0][1]).toEqual([7, 71]);
    expect(db.query.mock.calls[1][1]).toEqual([7, 71]);
    expect(db.query.mock.calls[2][1]).toEqual([7, '6', 'morning', '{"day":6,"timeSlot":"morning"}', '2026-09-12']);
    expect(db.query.mock.calls[2][0]).toContain('s.enrollment_date <= ?');
});

test('missing academy-scoped schedule never reads a roster', async () => {
    db.query.mockResolvedValueOnce([[]]);
    expect(await getAttendanceState(7, 71)).toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1);
});

test('invalid schedule IDs are rejected before database access', async () => {
    expect((await request(app()).get('/paca/schedules/1oops/attendance-state')).status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
});
