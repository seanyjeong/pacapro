/**
 * routes/instructors/auth.js 테스트 (Phase 2 #4 — instructors 도메인 분리)
 *
 * ⛔ ADR-007 보안 영역 — 본 sub-라우터는 원본 instructors.js 코드 무수정 이전.
 * 회귀 테스트는 분리 자체가 동작/응답 표면을 깨지 않았는지만 검증.
 *
 * 회귀 보호 범위:
 *   - POST /verify-admin-password 응답 표면 (ADR-013):
 *     200 → { message: 'Password verified', verified: true }
 *     400 → { error: 'Validation Error', message: 'Password is required' }
 *     401 → { error: 'Unauthorized', message: 'Invalid password', verified: false }
 *     404 → { error: 'Not Found', message: 'User not found' }
 *     500 → { error: 'Server Error', message: 'Failed to verify password' }
 *   - bcrypt.compare 호출 시그니처 보존
 *   - db.query (원본 보존, ADR-007 자동 변경 X) 호출 횟수
 */

// --- mock: DB pool ---
jest.mock('../../../config/database', () => ({
  query: jest.fn(),
  execute: jest.fn(),
}));

// --- mock: 인증 미들웨어 ---
jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 1, id: 100, role: 'owner' };
    next();
  }),
  checkPermission: jest.fn(() => (req, res, next) => next()),
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

// --- mock: bcrypt ---
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

// --- mock: logger ---
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// --- 외부 헬퍼 mock (_utils 가 require) ---
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

const express = require('express');
const request = require('supertest');
const db = require('../../../config/database');
const bcrypt = require('bcryptjs');

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  require('../../../routes/instructors/auth')(router);
  app.use('/paca/instructors', router);
  return app;
}

function resetMocks() {
  db.query.mockReset();
  db.execute.mockReset();
  bcrypt.compare.mockReset();
}

describe('POST /paca/instructors/verify-admin-password', () => {
  beforeEach(() => resetMocks());

  test('비밀번호 누락 → 400 Validation Error', async () => {
    const res = await request(makeApp())
      .post('/paca/instructors/verify-admin-password')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Validation Error',
      message: 'Password is required',
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('사용자 미존재 → 404 Not Found', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(makeApp())
      .post('/paca/instructors/verify-admin-password')
      .send({ password: 'test123' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Not Found',
      message: 'User not found',
    });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][1]).toEqual([100]);  // req.user.id
  });

  test('비밀번호 불일치 → 401 + verified: false', async () => {
    db.query.mockResolvedValueOnce([[{ id: 100, password: '$2a$hashed' }]]);
    bcrypt.compare.mockResolvedValueOnce(false);

    const res = await request(makeApp())
      .post('/paca/instructors/verify-admin-password')
      .send({ password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'Unauthorized',
      message: 'Invalid password',
      verified: false,
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('wrong', '$2a$hashed');
  });

  test('비밀번호 일치 → 200 + verified: true', async () => {
    db.query.mockResolvedValueOnce([[{ id: 100, password: '$2a$hashed' }]]);
    bcrypt.compare.mockResolvedValueOnce(true);

    const res = await request(makeApp())
      .post('/paca/instructors/verify-admin-password')
      .send({ password: 'correct' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Password verified',
      verified: true,
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('correct', '$2a$hashed');
  });

  test('DB 에러 → 500 Server Error (영문 표면 보존, ADR-007)', async () => {
    db.query.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(makeApp())
      .post('/paca/instructors/verify-admin-password')
      .send({ password: 'test' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Server Error',
      message: 'Failed to verify password',
    });
    // e.message 누출 0건
    expect(JSON.stringify(res.body)).not.toMatch(/DB connection lost/);
  });
});
