jest.mock('../../config/database', () => ({
  getConnection: jest.fn(),
  query: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 1, id: 100, role: 'owner' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../utils/encryption', () => ({
  decrypt: jest.fn(v => v && String(v).replace(/^enc:/, '')),
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../../config/database');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/paca/staff', require('../../routes/staff'));
  return app;
}

function makeConnection() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    release: jest.fn(),
    rollback: jest.fn().mockResolvedValue(undefined),
  };
}

describe('POST /paca/staff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('중복 이메일이면 409와 한국어 안내를 반환하고 계정을 만들지 않는다', async () => {
    const connection = makeConnection();
    db.getConnection.mockResolvedValue(connection);
    connection.query
      .mockResolvedValueOnce([[{ id: 7, name: 'enc:박강사' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 12 }]]);

    const res = await request(makeApp())
      .post('/paca/staff')
      .send({
        instructor_id: 7,
        email: 'manager@example.com',
        password: 'password123',
        permissions: { students: { view: true, edit: false } },
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('이미 사용 중인 이메일입니다.');
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(connection.query).toHaveBeenCalledTimes(3);
  });
});
