jest.mock('../../../config/database', () => ({ query: jest.fn() }));
jest.mock('../../../utils/encryption', () => ({
  decrypt: jest.fn((value) => String(value).replace(/^enc_/, '')),
}));
jest.mock('../../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../../../routes/jungsi/client', () => ({
  fetchJungsiBranches: jest.fn(),
  fetchJungsiStudents: jest.fn(),
}));

const originalEnv = { ...process.env };
const READ_KEY = 'maxlink-read-key-with-more-than-32-bytes';
process.env.JWT_SECRET = 'test-paca-jwt-secret';
process.env.MAXLINK_READ_API_KEY = READ_KEY;
process.env.PACA_NOTIFICATION_API_KEY = 'test-paca-notification-key';

const express = require('express');
const request = require('supertest');
const db = require('../../../config/database');
const {
  fetchJungsiBranches,
  fetchJungsiStudents,
} = require('../../../routes/jungsi/client');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/paca/jungsi', require('../../../routes/jungsi'));
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JUNGSI_JWT_SECRET = 'test-jungsi-secret';
  db.query.mockResolvedValueOnce([[
    {
      academy_id: 2,
      academy_name: '일산 맥스체대입시',
      grade: '고3',
      id: 77,
      jungsi_student_id: null,
      name: 'enc_권동욱',
      school: '일산고',
    },
  ]]);
  fetchJungsiBranches.mockResolvedValue(['천안', '일산']);
  fetchJungsiStudents.mockResolvedValue([
    {
      grade: '고3',
      school_name: '일산고',
      scores: { 국어_등급: '6', 영어_등급: '4' },
      student_id: 991,
      student_name: '권동욱',
    },
  ]);
});

afterAll(() => {
  process.env = originalEnv;
});

test('원장 지점 연결을 조회하지 않고 교육원과 학생으로 정시 성적을 자동 식별한다', async () => {
  const res = await request(makeApp())
    .get('/paca/jungsi/family-scores/77?academy_id=2&year=2027&exam=6%EC%9B%94')
    .set('X-API-Key', READ_KEY);

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    academyId: 2,
    branchName: '일산',
    matched: true,
    matchMethod: 'auto-name+school+grade',
    success: true,
    student: { paca: { id: 77 }, jungsi: { student_id: 991 } },
    scores: { exam: '6월', year: '2027', 국어: { 등급: '6' } },
  });
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(db.query.mock.calls[0][0]).not.toContain('academy_settings');
  expect(fetchJungsiStudents).toHaveBeenCalledTimes(1);
  expect(fetchJungsiStudents).toHaveBeenCalledWith('일산', '2027', '6월');
});

test('타 교육원 학생이면 정시엔진을 호출하지 않는다', async () => {
  db.query.mockReset();
  db.query.mockResolvedValueOnce([[]]);

  const res = await request(makeApp())
    .get('/paca/jungsi/family-scores/77?academy_id=3&year=2027&exam=6%EC%9B%94')
    .set('X-API-Key', READ_KEY);

  expect(res.status).toBe(404);
  expect(res.body.message).toBe('학생 정보를 확인할 수 없습니다.');
  expect(fetchJungsiBranches).not.toHaveBeenCalled();
  expect(fetchJungsiStudents).not.toHaveBeenCalled();
});

test('학생을 찾지 못해도 원장 연동을 요구하지 않고 미제출 상태로 응답한다', async () => {
  fetchJungsiStudents.mockResolvedValueOnce([]);

  const res = await request(makeApp())
    .get('/paca/jungsi/family-scores/77?academy_id=2&year=2027&exam=6%EC%9B%94')
    .set('X-API-Key', READ_KEY);

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: true, matched: false });
  expect(JSON.stringify(res.body)).not.toContain('연동');
  expect(JSON.stringify(res.body)).not.toContain('원장');
});

test('전용 키가 없으면 가족 성적 계약을 호출할 수 없다', async () => {
  const res = await request(makeApp())
    .get('/paca/jungsi/family-scores/77?academy_id=2&year=2027&exam=6%EC%9B%94');

  expect(res.status).toBe(401);
  expect(fetchJungsiBranches).not.toHaveBeenCalled();
  expect(fetchJungsiStudents).not.toHaveBeenCalled();
});
