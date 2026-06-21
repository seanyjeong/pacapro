/**
 * routes/instructors/overtime.js 테스트 (Phase 2 #4 — instructors 도메인 분리)
 *
 * 회귀 보호 범위:
 *   - 4 endpoint × 응답 표면 (ADR-013):
 *     GET /overtime/pending             → { message, requests }
 *     GET /overtime/history             → { message, requests }
 *     PUT /overtime/:approvalId/approve → { message, overtime }
 *     POST /:id/overtime                → { message, overtime }
 *   - DB 호출 패턴 (ADR-005): pool.execute 만 사용 (db.query / pool.query 잔존 0건)
 *   - 한국어 친화 메시지 (ADR-003)
 *   - decrypt(name) 호출 시그니처 보존 (ADR-007)
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
jest.mock('../../../utils/salaryCalculator', () => ({
  updateSalaryFromAttendance: jest.fn(),
}));
jest.mock('../../../utils/peak-trainer-sync', () => ({
  syncPeakTrainerAsync: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { decrypt } = require('../../../utils/encryption');

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  require('../../../routes/instructors/overtime')(router);
  app.use('/paca/instructors', router);
  return app;
}

function resetMocks() {
  pool.execute.mockReset();
  pool.query.mockReset();
  decrypt.mockClear();
}

describe('GET /paca/instructors/overtime/pending', () => {
  beforeEach(() => resetMocks());

  test('대기 중인 요청 목록 조회 + decrypt(name) 호출', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 1, instructor_id: 10, instructor_name: 'enc:홍길동', salary_type: 'hourly', hourly_rate: 30000, status: 'pending' },
      { id: 2, instructor_id: 11, instructor_name: 'enc:김철수', salary_type: 'monthly', hourly_rate: 0, status: 'pending' },
    ]]);

    const res = await request(makeApp()).get('/paca/instructors/overtime/pending');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Found 2 pending requests');
    expect(res.body.requests).toHaveLength(2);
    expect(res.body.requests[0].instructor_name).toBe('홍길동');
    expect(res.body.requests[1].instructor_name).toBe('김철수');
    // ADR-005: pool.execute 만
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.execute.mock.calls[0][1]).toEqual([1]);  // academyId
  });

  test('5xx 시 한국어 메시지 + e.message 누출 X (ADR-003)', async () => {
    pool.execute.mockRejectedValueOnce(new Error('mysql gone away'));

    const res = await request(makeApp()).get('/paca/instructors/overtime/pending');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server Error');
    expect(res.body.message).toMatch(/대기 중인 승인 요청을 불러오지 못했습니다/);
    expect(JSON.stringify(res.body)).not.toMatch(/mysql gone away/);
  });
});

describe('GET /paca/instructors/overtime/history', () => {
  beforeEach(() => resetMocks());

  test('필터 없이 조회 (academy_id 만)', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 1, instructor_name: 'enc:홍길동', approved_by_name: 'enc:관리자', status: 'approved' },
    ]]);

    const res = await request(makeApp()).get('/paca/instructors/overtime/history');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Found 1 overtime records');
    expect(res.body.requests[0].instructor_name).toBe('홍길동');
    expect(res.body.requests[0].approved_by_name).toBe('관리자');
    expect(pool.execute.mock.calls[0][1]).toEqual([1]);
  });

  test('year/month 필터 → DATE_FORMAT 조건 추가', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await request(makeApp()).get('/paca/instructors/overtime/history?year=2026&month=4');

    expect(pool.execute.mock.calls[0][0]).toMatch(/DATE_FORMAT\(oa\.work_date, '%Y-%m'\) = \?/);
    expect(pool.execute.mock.calls[0][1]).toEqual([1, '2026-04']);
  });

  test('instructor_id 필터 추가', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await request(makeApp()).get('/paca/instructors/overtime/history?instructor_id=10');

    expect(pool.execute.mock.calls[0][0]).toMatch(/AND oa\.instructor_id = \?/);
    expect(pool.execute.mock.calls[0][1]).toEqual([1, '10']);
  });

  test('approved_by_name null safe', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 1, instructor_name: 'enc:홍길동', approved_by_name: null, status: 'pending' },
    ]]);

    const res = await request(makeApp()).get('/paca/instructors/overtime/history');

    expect(res.status).toBe(200);
    expect(res.body.requests[0].approved_by_name).toBeNull();
  });
});

describe('PUT /paca/instructors/overtime/:approvalId/approve', () => {
  beforeEach(() => resetMocks());

  test('status 누락 → 400 한국어', async () => {
    const res = await request(makeApp())
      .put('/paca/instructors/overtime/5/approve')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.message).toMatch(/approved 또는 rejected/);
  });

  test('status 잘못된 값 → 400', async () => {
    const res = await request(makeApp())
      .put('/paca/instructors/overtime/5/approve')
      .send({ status: 'maybe' });

    expect(res.status).toBe(400);
  });

  test('요청 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp())
      .put('/paca/instructors/overtime/999/approve')
      .send({ status: 'approved' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toMatch(/승인 요청을 찾을 수 없습니다/);
  });

  test('이미 처리된 요청 → 400 Invalid State', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 5, status: 'approved' }]]);

    const res = await request(makeApp())
      .put('/paca/instructors/overtime/5/approve')
      .send({ status: 'rejected' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid State');
    expect(res.body.message).toMatch(/이미 처리된 요청/);
  });

  test('정상 승인 → 200 + UPDATE 호출 + 응답 표면 보존', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 5, status: 'pending' }]])  // SELECT
      .mockResolvedValueOnce([{ affectedRows: 1 }])              // UPDATE
      .mockResolvedValueOnce([[{ id: 5, status: 'approved', approved_by: 100 }]]);  // SELECT updated

    const res = await request(makeApp())
      .put('/paca/instructors/overtime/5/approve')
      .send({ status: 'approved', notes: '확인됨' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Overtime request approved');
    expect(res.body.overtime).toEqual({ id: 5, status: 'approved', approved_by: 100 });
    // ADR-005: pool.execute 만
    expect(pool.execute).toHaveBeenCalledTimes(3);
    expect(pool.query).not.toHaveBeenCalled();
    // UPDATE params 검증
    expect(pool.execute.mock.calls[1][1]).toEqual(['approved', 100, '확인됨', 5]);
  });

  test('5xx 시 한국어 + e.message 누출 X', async () => {
    pool.execute.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(makeApp())
      .put('/paca/instructors/overtime/5/approve')
      .send({ status: 'approved' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/승인 처리에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/connection refused/);
  });
});

describe('POST /paca/instructors/:id/overtime', () => {
  beforeEach(() => resetMocks());

  test('work_date 누락 → 400 한국어', async () => {
    const res = await request(makeApp())
      .post('/paca/instructors/10/overtime')
      .send({ request_type: 'extra_day' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/근무일자.*필수/);
  });

  test('request_type 누락 → 400', async () => {
    const res = await request(makeApp())
      .post('/paca/instructors/10/overtime')
      .send({ work_date: '2026-04-30' });

    expect(res.status).toBe(400);
  });

  test('강사 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp())
      .post('/paca/instructors/999/overtime')
      .send({ work_date: '2026-04-30', request_type: 'extra_day' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/강사 정보를 찾을 수 없습니다/);
  });

  test('중복 요청 → 400 Duplicate 한국어', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10, name: 'enc:홍길동', instructor_type: 'teacher' }]])  // 강사 존재
      .mockResolvedValueOnce([[{ id: 99 }]]);  // 중복 발견

    const res = await request(makeApp())
      .post('/paca/instructors/10/overtime')
      .send({ work_date: '2026-04-30', time_slot: 'morning', request_type: 'extra_day' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Duplicate');
    expect(res.body.message).toMatch(/이미 등록된 요청/);
  });

  test('정상 생성 → 201 + INSERT 호출 + 응답 표면 보존', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10, name: 'enc:홍길동', instructor_type: 'teacher' }]])  // 강사 존재
      .mockResolvedValueOnce([[]])  // 중복 없음
      .mockResolvedValueOnce([{ insertId: 200 }])  // INSERT
      .mockResolvedValueOnce([[{ id: 200, instructor_id: 10, work_date: '2026-04-30', request_type: 'extra_day', status: 'pending' }]]);  // SELECT

    const res = await request(makeApp())
      .post('/paca/instructors/10/overtime')
      .send({
        work_date: '2026-04-30',
        time_slot: 'morning',
        request_type: 'extra_day',
        original_end_time: '12:00',
        actual_end_time: '14:00',
        overtime_minutes: 120,
        notes: '추가 근무'
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Overtime request created');
    expect(res.body.overtime).toEqual({ id: 200, instructor_id: 10, work_date: '2026-04-30', request_type: 'extra_day', status: 'pending' });
    // ADR-005
    expect(pool.execute).toHaveBeenCalledTimes(4);
    expect(pool.query).not.toHaveBeenCalled();
    // INSERT params 정확히
    expect(pool.execute.mock.calls[2][1]).toEqual([
      1, 10, '2026-04-30', 'morning', 'extra_day', '12:00', '14:00', 120, '추가 근무'
    ]);
  });

  test('time_slot null → <=> 매칭 가능', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 201 }])
      .mockResolvedValueOnce([[{ id: 201 }]]);

    await request(makeApp())
      .post('/paca/instructors/10/overtime')
      .send({ work_date: '2026-04-30', request_type: 'overtime' });

    // 중복 확인 SQL 의 time_slot 자리에 null 들어가는지
    expect(pool.execute.mock.calls[1][0]).toMatch(/time_slot <=> \?/);
    expect(pool.execute.mock.calls[1][1]).toEqual([10, '2026-04-30', null]);
  });

  test('5xx 시 한국어 + e.message 누출 X', async () => {
    pool.execute.mockRejectedValueOnce(new Error('disk full'));

    const res = await request(makeApp())
      .post('/paca/instructors/10/overtime')
      .send({ work_date: '2026-04-30', request_type: 'extra_day' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/추가 근무 요청 생성에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/disk full/);
  });
});
