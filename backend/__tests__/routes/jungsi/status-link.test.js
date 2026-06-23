jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = mockUser;
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
  decrypt: jest.fn((v) => v),
}));

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../../../config/database');
const axios = require('axios');

let mockUser;
let settingsStore;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/paca/jungsi', require('../../../routes/jungsi'));
  return app;
}

function mockSettingsDb() {
  db.query.mockImplementation(async (sql, params) => {
    if (sql.includes('SELECT settings FROM academy_settings')) {
      return [[{ settings: JSON.stringify(settingsStore) }]];
    }
    if (sql.includes('SELECT id FROM academy_settings')) {
      return [[{ id: 1 }]];
    }
    if (sql.includes('UPDATE academy_settings SET settings = ?')) {
      settingsStore = JSON.parse(params[0]);
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('INSERT INTO academy_settings')) {
      settingsStore = params[1] ? JSON.parse(params[1]) : {};
      return [{ insertId: 1 }];
    }
    return [[]];
  });
}

beforeEach(() => {
  mockUser = { id: 10, userId: 10, academyId: 2, role: 'owner' };
  settingsStore = {};
  db.query.mockReset();
  axios.get.mockReset();
  axios.get.mockResolvedValue({ status: 200, data: { success: true } });
  process.env.JUNGSI_JWT_SECRET = 'test-jungsi-secret';
  process.env.JUNGSI_FRONTEND_BASE = 'https://seanyjeong.github.io/maxjungsi222';
  process.env.PACA_API_BASE = 'https://chejump.com/paca';
  mockSettingsDb();
});

describe('GET /paca/jungsi/status', () => {
  test('연동 설정이 없으면 hardcoded mapping 없이 미설정으로 응답한다', async () => {
    const res = await request(makeApp()).get('/paca/jungsi/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.academyId).toBe(2);
    expect(res.body.isConfigured).toBe(false);
    expect(res.body.branchName).toBeNull();
    expect(res.body.link.required).toBe(true);
    expect(res.body.mapping).toBeUndefined();
  });
});

describe('POST /paca/jungsi/link/start', () => {
  test('PACA 로그인 사용자의 학원에 1회성 연동 state를 저장하고 정시엔진 로그인 URL을 반환한다', async () => {
    const res = await request(makeApp()).post('/paca/jungsi/link/start').send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mode).toBe('jungsi_login');
    expect(res.body.loginUrl).toContain('https://seanyjeong.github.io/maxjungsi222/jungsilogin.html');
    expect(res.body.loginUrl).toContain('paca_link_state=');
    expect(res.body.loginUrl).toContain('paca_link_callback=');
    expect(settingsStore.jungsiLink.pending.stateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(settingsStore.jungsiLink.pending.createdByUserId).toBe(10);
  });

  test('정시엔진 로그인 callback이 branch를 검증해 학원 연동 지점으로 저장한다', async () => {
    const start = await request(makeApp()).post('/paca/jungsi/link/start').send({});
    const state = new URL(start.body.loginUrl).searchParams.get('paca_link_state');
    const jungsiToken = jwt.sign(
      { userid: 'jungsi-owner', name: '원장', branch: '일산' },
      'test-jungsi-secret'
    );

    const res = await request(makeApp())
      .post('/paca/jungsi/link/callback')
      .send({ state, token: jungsiToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.branchName).toBe('일산');
    expect(settingsStore.jungsiLink.branchName).toBe('일산');
    expect(settingsStore.jungsiLink.jungsiUserId).toBe('jungsi-owner');
    expect(settingsStore.jungsiLink.pending).toBeUndefined();
  });
});
