jest.mock('../../../config/database', () => {
  const fakeConn = {
    execute: jest.fn(),
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };
  return {
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn().mockResolvedValue(fakeConn),
    __conn: fakeConn,
  };
});

jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 1, userId: 100, role: 'owner' };
    next();
  }),
  checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../routes/students/_utils', () => ({
  autoAssignStudentToSchedules: jest.fn(),
}));

jest.mock('../../../repositories/restCreditRepository', () => ({
  findCurrentRestCreditsForUpdate: jest.fn(),
  updateRecalculatedCredit: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const repository = require('../../../repositories/restCreditRepository');
const { autoAssignStudentToSchedules } = require('../../../routes/students/_utils');

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  require('../../../routes/students/rest')(router);
  app.use('/paca/students', router);
  return app;
}

function makePausedStudent(overrides = {}) {
  return {
    id: 1,
    academy_id: 1,
    name: 'X',
    status: 'paused',
    class_days: null,
    monthly_tuition: 400000,
    discount_rate: 0,
    due_day: 5,
    rest_start_date: '2026-08-12',
    rest_end_date: null,
    ...overrides,
  };
}

function makeRestCredit(overrides = {}) {
  return {
    id: 12,
    rest_start_date: '2026-08-12',
    rest_end_date: '2026-08-31',
    rest_days: 20,
    credit_amount: 258000,
    remaining_amount: 258000,
    credit_type: 'carryover',
    status: 'pending',
    ...overrides,
  };
}

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
  repository.findCurrentRestCreditsForUpdate.mockReset().mockResolvedValue([]);
  repository.updateRecalculatedCredit.mockReset().mockResolvedValue();
}

function mockCriticalResume(student = makePausedStudent()) {
  pool.__conn.execute.mockResolvedValueOnce([[student], []]);
  pool.__conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
}

function mockPostResume(student = { id: 1, status: 'active' }, existingPayment = []) {
  pool.execute.mockResolvedValueOnce([existingPayment, []]);
  pool.execute.mockResolvedValueOnce([[student], []]);
}

describe('POST /paca/students/:id/resume', () => {
  beforeEach(resetMocks);

  test('학생 미존재 시 트랜잭션을 되돌리고 한국어 404를 반환한다', async () => {
    pool.__conn.execute.mockResolvedValueOnce([[], []]);

    const res = await request(makeApp())
      .post('/paca/students/999/resume')
      .send({ resume_date: '2026-08-20' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: '학생 정보를 찾을 수 없습니다.' });
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
    expect(pool.__conn.commit).not.toHaveBeenCalled();
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
  });

  test('휴식 상태가 아닌 학생은 변경 없이 한국어 400을 반환한다', async () => {
    pool.__conn.execute.mockResolvedValueOnce([[makePausedStudent({ status: 'active' })], []]);

    const res = await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-20' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'VALIDATION_ERROR', message: '휴식 상태인 학생만 복귀할 수 있습니다.' });
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('크레딧이 없어도 상태 변경과 응답 계약을 트랜잭션으로 보존한다', async () => {
    mockCriticalResume(makePausedStudent({ monthly_tuition: 0 }));
    mockPostResume();

    const res = await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-20' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: '2026-08-20 복귀 처리가 완료되었습니다.',
      student: { id: 1, status: 'active' },
      scheduleAssigned: null,
      paymentCreated: null,
      creditRecalculation: null,
      resumeDate: '2026-08-20',
    });
    expect(pool.__conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(pool.__conn.commit).toHaveBeenCalledTimes(1);
    expect(pool.__conn.rollback).not.toHaveBeenCalled();
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
  });

  test('복귀 시 미사용 크레딧을 실제 8일분으로 재계산해 응답한다', async () => {
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([makeRestCredit()]);
    mockCriticalResume();
    mockPostResume({ id: 1, status: 'active' }, [{ id: 2464 }]);

    const res = await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-20' });

    expect(res.status).toBe(200);
    expect(res.body.creditRecalculation).toMatchObject({
      adjusted: true,
      previousAmount: 258000,
      creditAmount: 103000,
      remainingAmount: 103000,
      restDays: 8,
      restEndDate: '2026-08-19',
    });
    expect(res.body.message).toContain('휴식 크레딧이 258,000원에서 103,000원으로 재계산되었습니다.');
    expect(repository.updateRecalculatedCredit).toHaveBeenCalledTimes(1);
    expect(pool.__conn.commit).toHaveBeenCalledTimes(1);
  });

  test('이미 사용한 금액이 정상 크레딧보다 크면 복귀 전체를 되돌리고 친화적인 안내를 반환한다', async () => {
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([
      makeRestCredit({ remaining_amount: 100000, status: 'partial' }),
    ]);
    pool.__conn.execute.mockResolvedValueOnce([[makePausedStudent()], []]);

    const res = await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-20' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'REST_CREDIT_RECALCULATION_CONFLICT',
      message: '이미 사용한 휴식 크레딧이 정상 금액보다 큽니다. 크레딧 사용 내역을 먼저 확인해주세요.',
    });
    expect(res.body.message).not.toMatch(/DB|HTTP|stack|CORS/i);
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
    expect(pool.__conn.commit).not.toHaveBeenCalled();
  });

  test('크레딧 저장 중 오류가 나면 학생 상태 변경까지 모두 되돌린다', async () => {
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([makeRestCredit()]);
    repository.updateRecalculatedCredit.mockRejectedValueOnce(new Error('write failed'));
    pool.__conn.execute.mockResolvedValueOnce([[makePausedStudent()], []]);

    const res = await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-20' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'RESUME_FAILED',
      message: '복귀 처리에 실패했습니다. 잠시 후 다시 시도해주세요.',
    });
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
    expect(pool.__conn.commit).not.toHaveBeenCalled();
    expect(pool.__conn.execute).toHaveBeenCalledTimes(1);
  });

  test('복귀 날짜가 휴식 시작일보다 빠르면 상태를 바꾸지 않는다', async () => {
    pool.__conn.execute.mockResolvedValueOnce([[makePausedStudent()], []]);

    const res = await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-11' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'VALIDATION_ERROR',
      message: '복귀 날짜는 휴식 시작일보다 빠를 수 없습니다.',
    });
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('수업 요일이 있으면 스케줄과 없는 월 학원비를 기존 방식대로 생성한다', async () => {
    mockCriticalResume(makePausedStudent({ class_days: '[1, 5]', monthly_tuition: 300000 }));
    pool.execute.mockResolvedValueOnce([[], []]);
    pool.execute.mockResolvedValueOnce([{ insertId: 99 }, []]);
    pool.execute.mockResolvedValueOnce([[{ id: 1, status: 'active' }], []]);
    autoAssignStudentToSchedules.mockResolvedValueOnce({ assigned: 5, created: 5 });

    const res = await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-20' });

    expect(res.status).toBe(200);
    expect(res.body.scheduleAssigned).toEqual({ assigned: 5, created: 5 });
    expect(res.body.paymentCreated).toMatchObject({ id: 99, yearMonth: '2026-08' });
    expect(autoAssignStudentToSchedules).toHaveBeenCalledWith(pool, 1, 1, [1, 5], '2026-08-20', 'evening');
    const insertCall = pool.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO student_payments'));
    expect(insertCall[1]).toContain('2026-08-20');
  });

  test('스케줄 자동 배정 실패는 기록하고 기존처럼 복귀를 완료한다', async () => {
    mockCriticalResume(makePausedStudent({ class_days: '[1, 5]', monthly_tuition: 0 }));
    mockPostResume();
    autoAssignStudentToSchedules.mockRejectedValueOnce(new Error('schedule conflict'));

    const res = await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-20' });

    expect(res.status).toBe(200);
    expect(res.body.scheduleAssigned).toBeNull();
    expect(res.body.student).toMatchObject({ id: 1, status: 'active' });
  });

  test('학생 조회 실패는 트랜잭션을 되돌리고 내부 오류를 노출하지 않는다', async () => {
    pool.__conn.execute.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-20' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'RESUME_FAILED',
      message: '복귀 처리에 실패했습니다. 잠시 후 다시 시도해주세요.',
    });
    expect(res.body.message).not.toContain('DB');
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
  });

  test('중요 상태 변경은 conn.execute만 사용하고 query 호출은 남기지 않는다', async () => {
    mockCriticalResume(makePausedStudent({ monthly_tuition: 0 }));
    mockPostResume();

    await request(makeApp())
      .post('/paca/students/1/resume')
      .send({ resume_date: '2026-08-20' });

    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.__conn.query).not.toHaveBeenCalled();
    expect(pool.__conn.execute.mock.calls.length).toBeGreaterThan(0);
  });
});
