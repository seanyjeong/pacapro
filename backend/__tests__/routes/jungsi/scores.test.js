jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { id: 10, userId: 10, academyId: 2, role: 'owner' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
  decrypt: jest.fn((value) => (typeof value === 'string' && value.startsWith('enc_') ? value.replace(/^enc_/, '') : value)),
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

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/paca/jungsi', require('../../../routes/jungsi'));
  return app;
}

beforeEach(() => {
  db.query.mockReset();
  axios.get.mockReset();
  process.env.JUNGSI_JWT_SECRET = 'test-jungsi-secret';
});

describe('GET /paca/jungsi/scores/:studentId', () => {
  test('연동된 branch 설정이 없으면 학생 성적 조회 전에 한국어 안내로 막는다', async () => {
    db.query.mockResolvedValueOnce([[{ settings: '{}' }]]);

    const res = await request(makeApp()).get('/paca/jungsi/scores/7?exam=6%EC%9B%94');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('정시엔진 연동을 먼저 완료해주세요.');
    expect(res.body.linkRequired).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('저장된 branch로 서버-서버 토큰을 발급해 정시엔진 학생 성적을 조회한다', async () => {
    db.query
      .mockResolvedValueOnce([[{
        settings: JSON.stringify({ jungsiLink: { branchName: '일산', linkedAt: '2026-06-23T00:00:00.000Z' } }),
      }]])
      .mockResolvedValueOnce([[{
        id: 7,
        name: 'enc_김진우',
        school: '일산고',
        grade: '고3',
        academy_id: 2,
      }]]);

    axios.get.mockResolvedValueOnce({
      data: {
        success: true,
        students: [{
          student_id: 77,
          student_name: '김진우',
          school_name: '일산고',
          grade: '고3',
          scores: {
            국어_등급: '2',
            수학_등급: '3',
            영어_등급: '1',
            탐구1_등급: '2',
            탐구2_등급: '4',
          },
        }],
      },
    });

    const res = await request(makeApp()).get('/paca/jungsi/scores/7?exam=6%EC%9B%94');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.matched).toBe(true);
    expect(res.body.scores.exam).toBe('6월');
    expect(res.body.scores.국어.등급).toBe('2');

    const callConfig = axios.get.mock.calls[0][1];
    const token = callConfig.headers.Authorization.replace('Bearer ', '');
    expect(jwt.verify(token, 'test-jungsi-secret').branch).toBe('일산');
    expect(callConfig.params).toEqual({ year: '2027', exam: '6월' });
  });
});
