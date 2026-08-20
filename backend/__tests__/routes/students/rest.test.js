/**
 * routes/students/rest/processRest.js 테스트 (Phase 2 #2, Tier 2 휴원)
 *
 * 회귀 보호 범위:
 *   - 응답 표면 (ADR-013 보존):
 *       POST /paca/students/:id/process-rest → { message, student, restCredit, unpaidAdjustment }
 *   - 에러: { error: '<영문코드>', message: '<한국어 친화 메시지>' } (ADR-003)
 *   - DB 호출 패턴 (ADR-005): pool.execute / conn.execute 만 사용 (db.query / pool.query / connection.query 잔존 0건).
 *   - 트랜잭션 (process-rest): 정상 → commit + release / 에러 → rollback + release / 검증 실패 → rollback + 4xx.
 */

// --- mock: DB pool + connection ---
jest.mock('../../../config/database', () => {
  const fakeConn = {
    execute: jest.fn(),
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };
  const fakePool = {
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn().mockResolvedValue(fakeConn),
    __conn: fakeConn,
  };
  return fakePool;
});

// --- mock: 인증 미들웨어 ---
jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 1, userId: 100, role: 'owner' };
    next();
  }),
  checkPermission: jest.fn(() => (req, res, next) => next()),
}));

// --- mock: logger ---
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// --- mock: _utils.autoAssignStudentToSchedules ---
jest.mock('../../../routes/students/_utils', () => ({
  autoAssignStudentToSchedules: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { autoAssignStudentToSchedules } = require('../../../routes/students/_utils');

// --- 라우터 mount (sub-라우터 패턴: module.exports = function(router) {...}) ---
function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  require('../../../routes/students/rest')(router);
  app.use('/paca/students', router);
  return app;
}

// --- 헬퍼: pool.execute / conn.execute mock 리셋 ---
function resetMocks() {
  pool.execute.mockReset();
  pool.query.mockReset();
  pool.getConnection.mockClear();
  pool.__conn.execute.mockReset();
  pool.__conn.query.mockReset();
  pool.__conn.beginTransaction.mockClear();
  pool.__conn.commit.mockClear();
  pool.__conn.rollback.mockClear();
  pool.__conn.release.mockClear();
  autoAssignStudentToSchedules.mockReset();
}

// =====================================================================
// POST /paca/students/:id/process-rest
// =====================================================================
describe('POST /paca/students/:id/process-rest', () => {
  beforeEach(resetMocks);

  test('학생 미존재 시 404 + 한국어 메시지 + rollback + release (ADR-003)', async () => {
    pool.__conn.execute.mockResolvedValueOnce([[], []]); // 학생 조회 빈 결과

    const app = makeApp();
    const res = await request(app)
      .post('/paca/students/999/process-rest')
      .send({ rest_start_date: '2026-05-01' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'NOT_FOUND',
      message: '학생 정보를 찾을 수 없습니다.',
    });
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
    expect(pool.__conn.commit).not.toHaveBeenCalled();
  });

  test('rest_start_date 누락 시 400 + 한국어 메시지 + rollback + release', async () => {
    pool.__conn.execute.mockResolvedValueOnce([
      [{ id: 1, name: 'X', monthly_tuition: 300000, discount_rate: 0, status: 'active', academy_id: 1 }],
      [],
    ]);

    const app = makeApp();
    const res = await request(app)
      .post('/paca/students/1/process-rest')
      .send({ /* rest_start_date 누락 */ });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'VALIDATION_ERROR',
      message: '휴식 시작일은 필수입니다.',
    });
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
    expect(pool.__conn.commit).not.toHaveBeenCalled();
  });

  test('정상 휴원 처리 (credit_type=none, 미납 학원비 X) → commit + 응답 표면 보존', async () => {
    // 1. 학생 조회
    pool.__conn.execute.mockResolvedValueOnce([
      [{ id: 1, name: 'X', monthly_tuition: 300000, discount_rate: 0, status: 'active', academy_id: 1 }],
      [],
    ]);
    // 3. 학생 status update
    pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // 3-1. 미납 학원비 조회 (없음)
    pool.__conn.execute.mockResolvedValueOnce([[], []]);
    // 5. 미래 미출석 스케줄 삭제
    pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    // 트랜잭션 외부: updated 학생 조회
    pool.execute.mockResolvedValueOnce([
      [{ id: 1, name: 'X', status: 'paused', rest_start_date: '2026-05-15' }],
      [],
    ]);

    const app = makeApp();
    const res = await request(app)
      .post('/paca/students/1/process-rest')
      .send({
        rest_start_date: '2026-05-15',
        rest_end_date: '2026-05-31',
        credit_type: 'none',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: '휴식 처리가 완료되었습니다.',
      student: { id: 1, status: 'paused' },
      restCredit: null,
      unpaidAdjustment: null,
    });
    expect(pool.__conn.commit).toHaveBeenCalledTimes(1);
    expect(pool.__conn.rollback).not.toHaveBeenCalled();
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
  });

  test('휴원 + carryover 크레딧 생성 → INSERT rest_credits 호출 + restCredit 응답', async () => {
    // 1. 학생 조회
    pool.__conn.execute.mockResolvedValueOnce([
      [{ id: 1, name: 'X', monthly_tuition: 300000, discount_rate: 0, status: 'active', academy_id: 1 }],
      [],
    ]);
    // 3. 학생 status update
    pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // 3-1. 미납 학원비 조회 (없음)
    pool.__conn.execute.mockResolvedValueOnce([[], []]);
    // 4. INSERT rest_credits
    pool.__conn.execute.mockResolvedValueOnce([{ insertId: 77 }, []]);
    // 4. SELECT rest_credits
    pool.__conn.execute.mockResolvedValueOnce([
      [{ id: 77, credit_amount: 150000, credit_type: 'carryover', status: 'pending' }],
      [],
    ]);
    // 5. DELETE attendance
    pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    // 외부: updated 학생
    pool.execute.mockResolvedValueOnce([[{ id: 1, status: 'paused' }], []]);

    const app = makeApp();
    const res = await request(app)
      .post('/paca/students/1/process-rest')
      .send({
        rest_start_date: '2026-05-15',
        rest_end_date: '2026-05-31',
        credit_type: 'carryover',
      });

    expect(res.status).toBe(200);
    expect(res.body.restCredit).toMatchObject({
      id: 77,
      credit_amount: 150000,
      credit_type: 'carryover',
      status: 'pending',
    });
    // INSERT 호출에 'INSERT INTO rest_credits' 포함 확인
    const insertCall = pool.__conn.execute.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO rest_credits')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[1][0]).toBe(1); // studentId
    expect(insertCall[1][8]).toBe('carryover'); // credit_type
    expect(pool.__conn.commit).toHaveBeenCalledTimes(1);
  });

  test('1일자 휴원 + 미납 학원비 → DELETE student_payments + unpaidAdjustment.action=deleted', async () => {
    // 학생 조회
    pool.__conn.execute.mockResolvedValueOnce([
      [{ id: 1, name: 'X', monthly_tuition: 300000, discount_rate: 0, status: 'active', academy_id: 1 }],
      [],
    ]);
    // status update
    pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // 미납 학원비 (있음)
    pool.__conn.execute.mockResolvedValueOnce([
      [{
        id: 50,
        base_amount: 300000,
        discount_amount: 0,
        final_amount: 300000,
        paid_amount: 0,
        payment_status: 'pending',
      }],
      [],
    ]);
    // DELETE student_payments
    pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // DELETE attendance
    pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    // 외부 학생 조회
    pool.execute.mockResolvedValueOnce([[{ id: 1, status: 'paused' }], []]);

    const app = makeApp();
    const res = await request(app)
      .post('/paca/students/1/process-rest')
      .send({
        rest_start_date: '2026-05-01',  // 1일자
        credit_type: 'none',
      });

    expect(res.status).toBe(200);
    expect(res.body.unpaidAdjustment).toMatchObject({
      action: 'deleted',
      originalAmount: 300000,
      adjustedAmount: 0,
    });
    // DELETE student_payments 호출 확인
    const deleteCall = pool.__conn.execute.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('DELETE FROM student_payments')
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall[1]).toEqual([50]);
  });

  test('트랜잭션 중간 에러 → rollback + release + 5xx 한국어 (ADR-003)', async () => {
    // 학생 조회 OK
    pool.__conn.execute.mockResolvedValueOnce([
      [{ id: 1, name: 'X', monthly_tuition: 300000, discount_rate: 0, status: 'active', academy_id: 1 }],
      [],
    ]);
    // status update 에러
    pool.__conn.execute.mockRejectedValueOnce(new Error('DB connection lost'));

    const app = makeApp();
    const res = await request(app)
      .post('/paca/students/1/process-rest')
      .send({
        rest_start_date: '2026-05-15',
        credit_type: 'none',
      });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'PROCESS_REST_FAILED',
      message: '휴원 처리에 실패했습니다. 잠시 후 다시 시도해주세요.',
    });
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
    expect(pool.__conn.commit).not.toHaveBeenCalled();
    // 사용자 노출 메시지에 e.message ('DB connection lost') 누출 X
    expect(res.body.message).not.toContain('DB');
    expect(res.body).not.toHaveProperty('detail');
  });

  test('ADR-005: process-rest 는 conn.execute 만 사용 (conn.query 호출 0회)', async () => {
    pool.__conn.execute.mockResolvedValueOnce([
      [{ id: 1, name: 'X', monthly_tuition: 300000, discount_rate: 0, status: 'active', academy_id: 1 }],
      [],
    ]);
    pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    pool.__conn.execute.mockResolvedValueOnce([[], []]);
    pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    pool.execute.mockResolvedValueOnce([[{ id: 1, status: 'paused' }], []]);

    const app = makeApp();
    await request(app)
      .post('/paca/students/1/process-rest')
      .send({ rest_start_date: '2026-05-15', credit_type: 'none' });

    expect(pool.__conn.query).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.__conn.execute.mock.calls.length).toBeGreaterThan(0);
    expect(pool.execute.mock.calls.length).toBeGreaterThan(0);
  });
});
