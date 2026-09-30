jest.mock('../../config/database', () => ({ execute: jest.fn() }));
jest.mock('../../config/peak-database', () => ({ execute: jest.fn() }));
jest.mock('../../utils/encryption', () => ({ decrypt: jest.fn(v => v?.replace(/^TEST:/, '')) }));
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/database');
const peak = require('../../config/peak-database');
const router = require('../../routes/integrations');
const { ISSUER, AUDIENCE, PAGE_SIZE } = require('../../config/maxEngine');

const app = express();
app.use(express.json());
app.use('/paca/integrations', router);
const base = '/paca/integrations/max-engine';
let user;
beforeEach(() => {
  process.env.MAX_ENGINE_LINK_SECRET = crypto.randomBytes(48).toString('hex');
  user = { id: 101, academy_id: 7, role: 'owner', is_active: 1, approval_status: 'approved',
    password_hash: bcrypt.hashSync('synthetic-password', 4) };
  db.execute.mockReset();
  peak.execute.mockReset();
});

async function token() {
  db.execute.mockResolvedValueOnce([[user]])
    .mockResolvedValueOnce([[{ id: 7, name: '합성 교육원', settings: { jungsiLink: { branchName: '합성' } } }]]);
  const response = await request(app).post(`${base}/token`)
    .send({ email: 'synthetic@example.invalid', password: 'synthetic-password' });
  expect(response.status).toBe(200);
  return response.body.access_token;
}

test('전용 교육원 토큰 발급은 SELECT만 사용하고 비밀·개인정보는 응답에서 제한한다', async () => {
  const value = await token();
  const claims = jwt.verify(value, process.env.MAX_ENGINE_LINK_SECRET, { issuer: ISSUER, audience: AUDIENCE });
  expect(claims).toMatchObject({ academy_id: 7, sub: '101', scope: 'students:read records:read' });
  expect(claims.exp - claims.iat).toBe(3600);
  expect(claims.userId).toBeUndefined();
  expect(db.execute.mock.calls.every(([sql]) => /^SELECT/.test(sql.trim()))).toBe(true);
});

test.each(['teacher', 'staff'])('%s 계정은 연결할 수 없다', async role => {
  db.execute.mockResolvedValueOnce([[{ ...user, role }]]);
  const response = await request(app).post(`${base}/token`)
    .send({ email: 'synthetic@example.invalid', password: 'synthetic-password' });
  expect(response.status).toBe(403);
});

test('기존 서비스 키와 일반 로그인 JWT는 새 API에서 거부한다', async () => {
  const wrong = jwt.sign({ userId: 101 }, crypto.randomBytes(32).toString('hex'));
  expect((await request(app).get(`${base}/snapshot`).set('x-api-key', 'synthetic-key')).status).toBe(401);
  expect((await request(app).get(`${base}/snapshot`).auth(wrong, { type: 'bearer' })).status).toBe(401);
  expect(db.execute).not.toHaveBeenCalled();
});

test('토큰 교육원만 조회하고 academy_id 강제 선택을 거부한다', async () => {
  const value = await token();
  db.execute.mockResolvedValueOnce([[user]]);
  const denied = await request(app).get(`${base}/snapshot?academy_id=8`).auth(value, { type: 'bearer' });
  expect(denied.status).toBe(422);
  db.execute.mockResolvedValueOnce([[user]]).mockResolvedValueOnce([[
    { id: 12, name: 'TEST:합성학생', phone: 'TEST:01000000000', parent_phone: null,
      gender: 'male', grade: '고3', school: '합성고', status: 'active', updated_at: '2026-09-27 12:00:00',
      address: 'must-not-return', tuition: 1234 },
  ]]);
  const response = await request(app).get(`${base}/snapshot`).auth(value, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.students[0]).toMatchObject({ paca_student_id: 12, name: '합성학생' });
  expect(response.body.students[0].address).toBeUndefined();
  expect(db.execute.mock.calls.at(-1)[1]).toEqual([7, 0]);
});

test.each(['academy', 'password', 'inactive', 'unapproved'])('%s 변경 후 이전 토큰 사용을 거부한다', async mode => {
  const value = await token();
  const changed = { ...user };
  if (mode === 'academy') changed.academy_id = 8;
  if (mode === 'password') changed.password_hash = bcrypt.hashSync('new-password', 4);
  if (mode === 'inactive') changed.is_active = 0;
  if (mode === 'unapproved') changed.approval_status = 'pending';
  db.execute.mockResolvedValueOnce([[changed]]);
  expect([401, 403]).toContain((await request(app).get(`${base}/snapshot`).auth(value, { type: 'bearer' })).status);
});

test('기록은 PACA 명단 범위·PEAK 교육원·날짜로 제한하고 원생 개인정보를 보내지 않는다', async () => {
  const value = await token();
  db.execute.mockResolvedValueOnce([[user]]).mockResolvedValueOnce([[{ id: 12, name: 'private' }]]);
  peak.execute.mockResolvedValueOnce([[{ paca_student_id: 12, record_id: 101, record_type_id: 3,
    record_type_name: '제자리멀리뛰기', unit: 'cm', value: '250.00', measured_at: '2026-09-20' }]])
    .mockResolvedValueOnce([[{ count: 2 }]]);
  const response = await request(app).get(`${base}/snapshot?dataset=records`).auth(value, { type: 'bearer' });
  expect(response.body).toMatchObject({ future_count: 2, records: [{ record_id: 101 }] });
  expect(JSON.stringify(response.body)).not.toContain('private');
  const [sql, params] = peak.execute.mock.calls[0];
  expect(params.slice(0, 2)).toEqual([7, 12]);
  expect(sql).toContain('sr.measured_at <= ?');
  expect(sql).toContain('sr.measured_at DESC, sr.id DESC');
  expect(sql).toContain('s.academy_id = sr.academy_id');
  expect(sql).toContain('rt.academy_id = sr.academy_id');
  expect(peak.execute.mock.calls.every(([q]) => /^SELECT/.test(q.trim()))).toBe(true);
});

test('명단 페이지 경계와 누락 키는 안전하게 처리한다', async () => {
  const value = await token();
  db.execute.mockResolvedValueOnce([[user]])
    .mockResolvedValueOnce([Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({ id: i + 1, name: '합성' }))]);
  const response = await request(app).get(`${base}/snapshot`).auth(value, { type: 'bearer' });
  expect(response.body.students).toHaveLength(PAGE_SIZE);
  expect(response.body.next_cursor).toBe(PAGE_SIZE);
  delete process.env.MAX_ENGINE_LINK_SECRET;
  expect((await request(app).get(`${base}/snapshot`).auth(value, { type: 'bearer' })).status).toBe(503);
});
