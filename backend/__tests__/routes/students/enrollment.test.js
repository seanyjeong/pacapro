/**
 * routes/students/enrollment.js 테스트 (Phase 2 #1, Tier 2 첫 모듈)
 *
 * 회귀 보호 범위:
 *   - 5 endpoint × 응답 표면 (ADR-013 보존):
 *       GET  /paca/students/rest-ended    → { message, students: [...] }
 *       POST /paca/students/:id/withdraw  → { message, student: {...} }
 *       POST /paca/students/grade-upgrade → { message, updated_count }
 *       POST /paca/students/auto-promote  → { message, dry_run, promoted, graduated, summary, details }
 *       GET  /paca/students/:id/seasons   → { message, student, seasons }
 *   - 에러: { error: '<영문코드>', message: '<한국어 친화 메시지>' } (ADR-003)
 *   - DB 호출 패턴 (ADR-005): pool.execute / conn.execute 만 사용 (pool.query 잔존 0건).
 *   - 보안 헬퍼 (ADR-007): decrypt(value) 시그니처 무변경, 라우터 안 직접 복호화 X.
 *   - 트랜잭션: dry_run=true → rollback / dry_run=false → commit / 에러 → rollback + release.
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
    req.user = { academyId: 1, id: 100, role: 'owner' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next()),
  checkPermission: jest.fn(() => (req, res, next) => next()),
}));

// --- mock: 보안 헬퍼 ---
jest.mock('../../../utils/encryption', () => ({
  decrypt: jest.fn((v) => (v == null ? v : `dec:${v}`)),
}));

// --- mock: logger ---
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { decrypt } = require('../../../utils/encryption');
const registerEnrollmentRoutes = require('../../../routes/students/enrollment');

function buildApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerEnrollmentRoutes(router);
  app.use('/paca/students', router);
  return app;
}

beforeEach(() => {
  pool.execute.mockReset();
  pool.query.mockReset();
  pool.getConnection.mockClear();
  pool.__conn.execute.mockReset();
  pool.__conn.query.mockReset();
  pool.__conn.beginTransaction.mockClear();
  pool.__conn.commit.mockClear();
  pool.__conn.rollback.mockClear();
  pool.__conn.release.mockClear();
  decrypt.mockClear();
});

// ==================== GET /rest-ended ====================
describe('GET /paca/students/rest-ended', () => {
  test('200 응답 표면: { message, students } + days_overdue 계산 + decrypt 호출 (ADR-013/007)', async () => {
    pool.execute.mockResolvedValueOnce([[
      {
        id: 1,
        name: 'enc-name1',
        phone: 'enc-phone1',
        school: '서울고',
        grade: '고2',
        rest_start_date: '2026-04-01',
        rest_end_date: '2026-04-20',
        rest_reason: '개인사정',
        class_days: '[1,3,5]',
        time_slot: '19:00',
        monthly_tuition: '300000',
        discount_rate: '0',
      },
    ]]);

    const app = buildApp();
    const res = await request(app).get('/paca/students/rest-ended');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Success');
    expect(Array.isArray(res.body.students)).toBe(true);
    expect(res.body.students).toHaveLength(1);
    const s = res.body.students[0];
    expect(s.name).toBe('dec:enc-name1');
    expect(s.phone).toBe('dec:enc-phone1');
    expect(typeof s.days_overdue).toBe('number');
    expect(s.days_overdue).toBeGreaterThan(0);
    expect(decrypt).toHaveBeenCalledWith('enc-name1');
    expect(decrypt).toHaveBeenCalledWith('enc-phone1');
  });

  test('phone null 이면 decrypt 호출 X', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 2, name: 'enc-name2', phone: null, rest_end_date: '2026-04-20' },
    ]]);
    const app = buildApp();
    const res = await request(app).get('/paca/students/rest-ended');
    expect(res.status).toBe(200);
    expect(res.body.students[0].phone).toBeNull();
    // decrypt 는 name 한 번만
    expect(decrypt).toHaveBeenCalledTimes(1);
    expect(decrypt).toHaveBeenCalledWith('enc-name2');
  });

  test('DB 호출 = pool.execute (ADR-005, pool.query 호출 X)', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const app = buildApp();
    await request(app).get('/paca/students/rest-ended');
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
    const [sql, params] = pool.execute.mock.calls[0];
    expect(sql).toMatch(/FROM students/);
    expect(sql).toMatch(/status = 'paused'/);
    expect(params[0]).toBe(1); // academyId
  });

  test('500 에러 한국어 메시지 (ADR-003)', async () => {
    pool.execute.mockRejectedValueOnce(new Error('db down'));
    const app = buildApp();
    const res = await request(app).get('/paca/students/rest-ended');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server Error');
    expect(res.body.message).toMatch(/휴원 종료 학생 목록/);
    expect(res.body.message).toMatch(/잠시 후 다시 시도/);
  });
});

// ==================== POST /:id/withdraw ====================
describe('POST /paca/students/:id/withdraw', () => {
  test('200 응답 표면: { message, student } + UPDATE + 미래 attendance DELETE (ADR-013)', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 5, name: 'enc-name', status: 'active' }]]) // SELECT
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE students
      .mockResolvedValueOnce([{ affectedRows: 3 }]); // DELETE attendance
    const app = buildApp();
    const res = await request(app)
      .post('/paca/students/5/withdraw')
      .send({ reason: '이사', withdrawal_date: '2026-04-30' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('퇴원 처리되었습니다');
    expect(res.body.student).toEqual({
      id: 5,
      name: 'enc-name',
      status: 'withdrawn',
      withdrawal_date: '2026-04-30',
      withdrawal_reason: '이사',
    });
    // 3번 호출: SELECT + UPDATE + DELETE
    expect(pool.execute).toHaveBeenCalledTimes(3);
    expect(pool.query).not.toHaveBeenCalled();
    const updateCall = pool.execute.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE students/);
    expect(updateCall[0]).toMatch(/status = 'withdrawn'/);
    const deleteCall = pool.execute.mock.calls[2];
    expect(deleteCall[0]).toMatch(/DELETE a FROM attendance/);
  });

  test('404 학생 없음 → 한국어 메시지', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const app = buildApp();
    const res = await request(app)
      .post('/paca/students/999/withdraw')
      .send({ reason: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toBe('학생 정보를 찾을 수 없습니다.');
  });

  test('400 이미 퇴원 → 한국어 메시지', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 5, name: 'n', status: 'withdrawn' }]]);
    const app = buildApp();
    const res = await request(app).post('/paca/students/5/withdraw').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toBe('이미 퇴원 처리된 학생입니다.');
  });

  test('500 에러 한국어 메시지 (ADR-003)', async () => {
    pool.execute.mockRejectedValueOnce(new Error('db down'));
    const app = buildApp();
    const res = await request(app).post('/paca/students/5/withdraw').send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server Error');
    expect(res.body.message).toMatch(/퇴원 처리에 실패/);
  });
});

// ==================== POST /grade-upgrade ====================
describe('POST /paca/students/grade-upgrade', () => {
  test('200 응답: { message, updated_count } + 트랜잭션 commit + conn.execute (ADR-005/013)', async () => {
    // SELECT 학원 소속 검증
    pool.execute.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]);
    pool.__conn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const app = buildApp();
    const res = await request(app)
      .post('/paca/students/grade-upgrade')
      .send({ upgrades: [
        { student_id: 1, new_grade: '고2' },
        { student_id: 2, new_status: 'inactive' },
      ] });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/2명의 학생 정보가 업데이트/);
    expect(res.body.updated_count).toBe(2);
    expect(pool.__conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(pool.__conn.commit).toHaveBeenCalledTimes(1);
    expect(pool.__conn.rollback).not.toHaveBeenCalled();
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
    // conn.execute 만 사용 (conn.query X)
    expect(pool.__conn.execute).toHaveBeenCalledTimes(2);
    expect(pool.__conn.query).not.toHaveBeenCalled();
  });

  test('400 빈 배열 → 한국어', async () => {
    const app = buildApp();
    const res = await request(app).post('/paca/students/grade-upgrade').send({ upgrades: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.message).toBe('진급 대상 목록이 비어 있습니다.');
  });

  test('400 student_id 누락 → 한국어', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/paca/students/grade-upgrade')
      .send({ upgrades: [{ new_grade: '고1' }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('학생 ID가 누락된 항목이 있습니다.');
  });

  test('400 invalid grade → 한국어', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/paca/students/grade-upgrade')
      .send({ upgrades: [{ student_id: 1, new_grade: 'X4' }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/유효하지 않은 학년/);
  });

  test('400 학생 일부 누락 → 한국어 + 누락 ID 표시', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 1 }]]); // 1명만 발견
    const app = buildApp();
    const res = await request(app)
      .post('/paca/students/grade-upgrade')
      .send({ upgrades: [
        { student_id: 1, new_grade: '고2' },
        { student_id: 99, new_grade: '고2' },
      ] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/일부 학생을 찾을 수 없습니다.*99/);
  });

  test('IN 절은 N개 ? 로 명시 펼침 (pool.execute prepared statement 호환)', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }, { id: 3 }]]);
    pool.__conn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const app = buildApp();
    await request(app)
      .post('/paca/students/grade-upgrade')
      .send({ upgrades: [
        { student_id: 1, new_grade: '고2' },
        { student_id: 2, new_grade: '고2' },
        { student_id: 3, new_grade: '고2' },
      ] });
    const [sql, params] = pool.execute.mock.calls[0];
    expect(sql).toMatch(/IN \(\?,\?,\?\)/);
    // params: [1, 2, 3, academyId]
    expect(params).toEqual([1, 2, 3, 1]);
  });

  test('트랜잭션 에러 → rollback + release + 500 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 1 }]]);
    pool.__conn.execute.mockRejectedValueOnce(new Error('boom'));
    const app = buildApp();
    const res = await request(app)
      .post('/paca/students/grade-upgrade')
      .send({ upgrades: [{ student_id: 1, new_grade: '고2' }] });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/학생 진급 처리에 실패/);
    expect(pool.__conn.rollback).toHaveBeenCalled();
    expect(pool.__conn.release).toHaveBeenCalled();
    expect(pool.__conn.commit).not.toHaveBeenCalled();
  });
});

// ==================== POST /auto-promote ====================
describe('POST /paca/students/auto-promote', () => {
  test('200 응답 표면 (ADR-013): { message, dry_run, promoted, graduated, summary, details } + commit', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 10, name: 'A', grade: '고1', status: 'active' },
      { id: 11, name: 'B', grade: '고3', status: 'active' },
    ]]);
    pool.__conn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const app = buildApp();
    const res = await request(app)
      .post('/paca/students/auto-promote')
      .send({ dry_run: false, graduate_student_ids: [11] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('dry_run', false);
    expect(res.body).toHaveProperty('promoted');
    expect(res.body).toHaveProperty('graduated');
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('details');
    expect(res.body.promoted).toBe(1);
    expect(res.body.graduated).toBe(1);
    expect(res.body.details).toHaveLength(2);
    expect(pool.__conn.commit).toHaveBeenCalledTimes(1);
    expect(pool.__conn.rollback).not.toHaveBeenCalled();
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
    // 호출 횟수: 고1 진급 1 + 고3 졸업(UPDATE+DELETE) 2 = 3
    expect(pool.__conn.execute).toHaveBeenCalledTimes(3);
    expect(pool.__conn.query).not.toHaveBeenCalled();
  });

  test('dry_run=true → 트랜잭션 rollback (commit X)', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 10, name: 'A', grade: '고1', status: 'active' },
    ]]);
    const app = buildApp();
    const res = await request(app)
      .post('/paca/students/auto-promote')
      .send({ dry_run: true });
    expect(res.status).toBe(200);
    expect(res.body.dry_run).toBe(true);
    expect(res.body.promoted).toBe(1);
    expect(pool.__conn.commit).not.toHaveBeenCalled();
    expect(pool.__conn.rollback).toHaveBeenCalledTimes(1);
    expect(pool.__conn.release).toHaveBeenCalledTimes(1);
    // dry_run 이므로 conn.execute 0회 (조회만 pool.execute)
    expect(pool.__conn.execute).not.toHaveBeenCalled();
  });

  test('진급 대상 0명 → early return + 트랜잭션 시작 X', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const app = buildApp();
    const res = await request(app).post('/paca/students/auto-promote').send({});
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('진급 대상 학생이 없습니다');
    expect(res.body.promoted).toBe(0);
    expect(res.body.graduated).toBe(0);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('500 에러 한국어 메시지 (ADR-003)', async () => {
    pool.execute.mockRejectedValueOnce(new Error('db down'));
    const app = buildApp();
    const res = await request(app).post('/paca/students/auto-promote').send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server Error');
    expect(res.body.message).toMatch(/학년 자동 진급 처리에 실패/);
  });
});

// ==================== GET /:id/seasons ====================
describe('GET /paca/students/:id/seasons', () => {
  test('200 응답 표면: { message, student, seasons } (ADR-013)', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 7, name: 'enc-stud' }]]) // SELECT student
      .mockResolvedValueOnce([[
        { enrollment_id: 1, season_id: 100, season_name: '여름특강' },
        { enrollment_id: 2, season_id: 101, season_name: '겨울특강' },
      ]]); // SELECT seasons
    const app = buildApp();
    const res = await request(app).get('/paca/students/7/seasons');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Found 2 season enrollments');
    expect(res.body.student).toEqual({ id: 7, name: 'enc-stud' });
    expect(Array.isArray(res.body.seasons)).toBe(true);
    expect(res.body.seasons).toHaveLength(2);
    expect(pool.execute).toHaveBeenCalledTimes(2);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('404 학생 없음 → 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const app = buildApp();
    const res = await request(app).get('/paca/students/999/seasons');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toBe('학생 정보를 찾을 수 없습니다.');
  });

  test('500 에러 한국어 메시지 (ADR-003)', async () => {
    pool.execute.mockRejectedValueOnce(new Error('db down'));
    const app = buildApp();
    const res = await request(app).get('/paca/students/7/seasons');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server Error');
    expect(res.body.message).toMatch(/학생 시즌 이력을 불러오지 못했습니다/);
  });
});
