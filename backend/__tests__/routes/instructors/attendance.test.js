/**
 * routes/instructors/attendance.js 테스트 (Phase 2 #4 — instructors 도메인 분리)
 *
 * 회귀 보호 범위:
 *   - 2 endpoint × 응답 표면 (ADR-013):
 *     POST /:id/attendance  → { message, attendance }   (200 update / 201 insert)
 *     GET  /:id/attendance  → { message, attendances }
 *   - DB 호출 패턴 (ADR-005): pool.execute 만 (db.query / pool.query 잔존 0건)
 *   - 한국어 친화 메시지 (ADR-003)
 *   - updateSalaryFromAttendance 시그니처 보존: (db, instructorId, academyId, work_date, status)
 */

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
  execute: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 1, id: 100, role: 'owner' };
    next();
  }),
  checkPermission: jest.fn(() => (req, res, next) => next()),
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
  encrypt: jest.fn(v => `enc:${v}`),
  decrypt: jest.fn(v => v && v.replace(/^enc:/, '')),
  encryptFields: jest.fn((obj) => obj),
  decryptFields: jest.fn((obj) => obj),
  decryptArrayFields: jest.fn((arr) => arr),
  ENCRYPTED_FIELDS: { instructors: ['name', 'phone'] },
}));
jest.mock('../../../utils/peak-trainer-sync', () => ({
  syncPeakTrainerAsync: jest.fn(),
}));
jest.mock('../../../utils/salaryCalculator', () => ({
  updateSalaryFromAttendance: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { updateSalaryFromAttendance } = require('../../../utils/salaryCalculator');

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  require('../../../routes/instructors/attendance')(router);
  app.use('/paca/instructors', router);
  return app;
}

function resetMocks() {
  pool.execute.mockReset();
  pool.query.mockReset();
  updateSalaryFromAttendance.mockReset();
}

describe('POST /paca/instructors/:id/attendance', () => {
  beforeEach(() => resetMocks());

  test('강사 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp())
      .post('/paca/instructors/999/attendance')
      .send({ work_date: '2026-04-30', time_slot: 'morning' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/강사 정보를 찾을 수 없습니다/);
  });

  test('work_date 누락 → 400 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 10, name: 'enc:홍' }]]);

    const res = await request(makeApp())
      .post('/paca/instructors/10/attendance')
      .send({ time_slot: 'morning' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/근무일자.*시간대.*필수/);
  });

  test('time_slot 누락 → 400', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 10 }]]);

    const res = await request(makeApp())
      .post('/paca/instructors/10/attendance')
      .send({ work_date: '2026-04-30' });

    expect(res.status).toBe(400);
  });

  test('existing 없음 → INSERT + 201 + updateSalaryFromAttendance 호출', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10, salary_type: 'hourly', hourly_rate: 30000, tax_type: '3.3%' }]])  // 강사
      .mockResolvedValueOnce([[]])  // existing 없음
      .mockResolvedValueOnce([{ insertId: 500 }])  // INSERT
      .mockResolvedValueOnce([[{ id: 500, work_date: '2026-04-30', time_slot: 'morning', attendance_status: 'present' }]]);  // SELECT created

    const res = await request(makeApp())
      .post('/paca/instructors/10/attendance')
      .send({
        work_date: '2026-04-30',
        time_slot: 'morning',
        check_in_time: '09:00',
        check_out_time: '12:00',
        attendance_status: 'present',
        notes: '정상 출근'
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Attendance recorded successfully');
    expect(res.body.attendance).toEqual({ id: 500, work_date: '2026-04-30', time_slot: 'morning', attendance_status: 'present' });
    // INSERT params 검증
    expect(pool.execute.mock.calls[2][1]).toEqual([10, '2026-04-30', 'morning', '09:00', '12:00', 'present', '정상 출근']);
    // updateSalaryFromAttendance 호출 (db, instructorId, academyId, workDate, status)
    expect(updateSalaryFromAttendance).toHaveBeenCalledTimes(1);
    expect(updateSalaryFromAttendance.mock.calls[0][1]).toBe(10);
    expect(updateSalaryFromAttendance.mock.calls[0][2]).toBe(1);
    expect(updateSalaryFromAttendance.mock.calls[0][3]).toBe('2026-04-30');
    expect(updateSalaryFromAttendance.mock.calls[0][4]).toBe('present');
    // ADR-005
    expect(pool.execute).toHaveBeenCalledTimes(4);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('existing 있음 → UPDATE + 200', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10, salary_type: 'hourly', hourly_rate: 30000, tax_type: '3.3%' }]])  // 강사
      .mockResolvedValueOnce([[{ id: 99 }]])  // existing 있음
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE
      .mockResolvedValueOnce([[{ id: 99, attendance_status: 'late' }]]);  // SELECT updated

    const res = await request(makeApp())
      .post('/paca/instructors/10/attendance')
      .send({
        work_date: '2026-04-30',
        time_slot: 'afternoon',
        check_in_time: '14:30',
        attendance_status: 'late'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Attendance updated successfully');
    expect(res.body.attendance).toEqual({ id: 99, attendance_status: 'late' });
    // UPDATE params: check_in_time, check_out_time(null), status, notes(null), id
    expect(pool.execute.mock.calls[2][1]).toEqual(['14:30', null, 'late', null, 99]);
    // updateSalary 호출
    expect(updateSalaryFromAttendance).toHaveBeenCalledTimes(1);
  });

  test('attendance_status 미지정 → 기본값 present', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 501 }])
      .mockResolvedValueOnce([[{ id: 501 }]]);

    await request(makeApp())
      .post('/paca/instructors/10/attendance')
      .send({ work_date: '2026-04-30', time_slot: 'morning' });

    expect(pool.execute.mock.calls[2][1][5]).toBe('present');
  });

  test('5xx 한국어 + e.message 누출 X', async () => {
    pool.execute.mockRejectedValueOnce(new Error('deadlock detected'));

    const res = await request(makeApp())
      .post('/paca/instructors/10/attendance')
      .send({ work_date: '2026-04-30', time_slot: 'morning' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/출퇴근 기록에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/deadlock detected/);
  });
});

describe('GET /paca/instructors/:id/attendance', () => {
  beforeEach(() => resetMocks());

  test('필터 없이 → instructor_id 만 조건', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 1, work_date: '2026-04-30', attendance_status: 'present' },
      { id: 2, work_date: '2026-04-29', attendance_status: 'late' },
    ]]);

    const res = await request(makeApp()).get('/paca/instructors/10/attendance');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Found 2 attendance records');
    expect(res.body.attendances).toHaveLength(2);
    expect(pool.execute.mock.calls[0][1]).toEqual([10]);
    // ADR-005
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('year/month 필터 → DATE_FORMAT 조건 추가', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await request(makeApp()).get('/paca/instructors/10/attendance?year=2026&month=4');

    expect(pool.execute.mock.calls[0][0]).toMatch(/DATE_FORMAT\(work_date, '%Y-%m'\) = \?/);
    expect(pool.execute.mock.calls[0][1]).toEqual([10, '2026-04']);
  });

  test('5xx 한국어 + e.message 누출 X', async () => {
    pool.execute.mockRejectedValueOnce(new Error('table locked'));

    const res = await request(makeApp()).get('/paca/instructors/10/attendance');

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/출퇴근 기록을 불러오지 못했습니다/);
    expect(JSON.stringify(res.body)).not.toMatch(/table locked/);
  });
});
