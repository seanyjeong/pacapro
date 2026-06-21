/**
 * routes/instructors/crud.js 테스트 (Phase 2 #4 — instructors 도메인 분리)
 *
 * 회귀 보호 범위:
 *   - 5 endpoint × 응답 표면 (ADR-013 보존):
 *     GET /              → { message, instructors }
 *     GET /:id           → { instructor, attendances, salaries }   (no message)
 *     POST /             → { message, instructor }                 (201)
 *     PUT /:id           → { message, instructor }
 *     DELETE /:id        → { message, instructor: { id, name } }
 *   - DB 호출 패턴 (ADR-005): pool.execute 만 (db.query / pool.query 잔존 0건)
 *   - 한국어 친화 메시지 (ADR-003)
 *   - 암호화 헬퍼 (encrypt) 호출 시그니처 보존 (ADR-007)
 *   - syncPeakTrainerAsync 호출 (POST/PUT/DELETE 후)
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
  decryptFields: jest.fn((obj) => obj),  // pass-through
  decryptArrayFields: jest.fn((arr) => arr),  // pass-through
  ENCRYPTED_FIELDS: { instructors: ['name', 'phone', 'resident_number', 'account_number', 'address'] },
}));
jest.mock('../../../utils/peak-trainer-sync', () => ({
  syncPeakTrainerAsync: jest.fn(),
}));
jest.mock('../../../utils/salaryCalculator', () => ({
  updateSalaryFromAttendance: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { encrypt, decryptFields, decryptArrayFields } = require('../../../utils/encryption');
const { syncPeakTrainerAsync } = require('../../../utils/peak-trainer-sync');

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  require('../../../routes/instructors/crud')(router);
  app.use('/paca/instructors', router);
  return app;
}

function resetMocks() {
  pool.execute.mockReset();
  pool.query.mockReset();
  encrypt.mockClear();
  decryptFields.mockClear();
  decryptArrayFields.mockClear();
  syncPeakTrainerAsync.mockClear();
}

describe('GET /paca/instructors', () => {
  beforeEach(() => resetMocks());

  test('필터 없이 → academyId + deleted_at IS NULL 만 조건', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 10, name: 'enc:홍길동' }, { id: 11, name: 'enc:김철수' }
    ]]);

    const res = await request(makeApp()).get('/paca/instructors');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Found 2 instructors');
    expect(res.body.instructors).toHaveLength(2);
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.execute.mock.calls[0][1]).toEqual([1]);
    // decryptArrayFields 호출 (ADR-007)
    expect(decryptArrayFields).toHaveBeenCalledTimes(1);
  });

  test('search 필터 → name LIKE OR phone LIKE + ?,?', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    // URL 한글은 encode 필요 (supertest unescaped chars 에러 회피)
    await request(makeApp()).get(`/paca/instructors?search=${encodeURIComponent('홍')}`);

    expect(pool.execute.mock.calls[0][0]).toMatch(/name LIKE \? OR i\.phone LIKE \?/);
    expect(pool.execute.mock.calls[0][1]).toEqual([1, '%홍%', '%홍%']);
  });

  test('status + salary_type + gender 복합 필터', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await request(makeApp()).get('/paca/instructors?status=active&salary_type=hourly&gender=female');

    expect(pool.execute.mock.calls[0][1]).toEqual([1, 'active', 'hourly', 'female']);
  });

  test('5xx 한국어 + e.message 누출 X', async () => {
    pool.execute.mockRejectedValueOnce(new Error('table missing'));

    const res = await request(makeApp()).get('/paca/instructors');

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/강사 목록을 불러오지 못했습니다/);
    expect(JSON.stringify(res.body)).not.toMatch(/table missing/);
  });
});

describe('GET /paca/instructors/:id', () => {
  beforeEach(() => resetMocks());

  test('강사 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).get('/paca/instructors/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/강사 정보를 찾을 수 없습니다/);
  });

  test('정상 조회 → { instructor, attendances, salaries } 표면 보존', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10, name: 'enc:홍길동', academy_name: 'tete' }]])  // 강사
      .mockResolvedValueOnce([[{ id: 1, work_date: '2026-04-29' }, { id: 2, work_date: '2026-04-28' }]])  // attendance LIMIT 30
      .mockResolvedValueOnce([[{ id: 1, year_month: '2026-04', net_salary: 1000000 }]]);  // salary LIMIT 12

    const res = await request(makeApp()).get('/paca/instructors/10');

    expect(res.status).toBe(200);
    // 응답 표면 보존: { instructor, attendances, salaries } — message 없음
    expect(res.body).toHaveProperty('instructor');
    expect(res.body).toHaveProperty('attendances');
    expect(res.body).toHaveProperty('salaries');
    expect(res.body).not.toHaveProperty('message');
    expect(res.body.attendances).toHaveLength(2);
    expect(res.body.salaries).toHaveLength(1);
    // ADR-005
    expect(pool.execute).toHaveBeenCalledTimes(3);
    expect(pool.query).not.toHaveBeenCalled();
    // decryptFields 호출 (ADR-007)
    expect(decryptFields).toHaveBeenCalledTimes(1);
  });
});

describe('POST /paca/instructors', () => {
  beforeEach(() => resetMocks());

  test('필수 필드 누락 → 400 한국어', async () => {
    const res = await request(makeApp())
      .post('/paca/instructors')
      .send({ name: '홍길동' });  // phone, salary_type, tax_type 없음

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/필수 입력 항목/);
  });

  test('salary_type 잘못된 값 → 400 한국어', async () => {
    const res = await request(makeApp())
      .post('/paca/instructors')
      .send({ name: '홍', phone: '010', salary_type: 'unknown', tax_type: '3.3%' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/급여 형태가 올바르지 않습니다/);
  });

  test('tax_type 잘못된 값 → 400', async () => {
    const res = await request(makeApp())
      .post('/paca/instructors')
      .send({ name: '홍', phone: '010', salary_type: 'monthly', base_salary: 3000000, tax_type: 'unknown' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/세무 유형이 올바르지 않습니다/);
  });

  test('monthly + base_salary 누락 → 400', async () => {
    const res = await request(makeApp())
      .post('/paca/instructors')
      .send({ name: '홍', phone: '010', salary_type: 'monthly', tax_type: '3.3%' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/기본급.*필수/);
  });

  test('hourly + hourly_rate 누락 → 400', async () => {
    const res = await request(makeApp())
      .post('/paca/instructors')
      .send({ name: '홍', phone: '010', salary_type: 'hourly', tax_type: '3.3%' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/시급.*필수/);
  });

  test('assistant + work_days 누락 → 400', async () => {
    const res = await request(makeApp())
      .post('/paca/instructors')
      .send({
        name: '홍', phone: '010',
        salary_type: 'hourly', instructor_type: 'assistant',
        hourly_rate: 15000, tax_type: '3.3%'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/근무 요일.*필수/);
  });

  test('정상 등록 → 201 + 암호화 + INSERT + syncPeakTrainerAsync', async () => {
    pool.execute
      .mockResolvedValueOnce([{ insertId: 50 }])  // INSERT
      .mockResolvedValueOnce([[{ id: 50, name: 'enc:홍길동' }]]);  // SELECT created

    const res = await request(makeApp())
      .post('/paca/instructors')
      .send({
        name: '홍길동',
        phone: '010-1111-2222',
        gender: 'male',
        salary_type: 'monthly',
        base_salary: 3000000,
        tax_type: '3.3%',
        bank_name: '국민',
        account_number: '123-456',
        address: '서울시'
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Instructor created successfully');
    expect(res.body.instructor).toEqual({ id: 50, name: 'enc:홍길동' });
    // ADR-007: encrypt 5건 (name, phone, residentNumber=null skip, account, address)
    // residentNumber 없으면 호출 X. account_number, address 있으면 호출.
    // 호출: name, phone, account_number, address = 4건
    expect(encrypt).toHaveBeenCalledWith('홍길동');
    expect(encrypt).toHaveBeenCalledWith('010-1111-2222');
    expect(encrypt).toHaveBeenCalledWith('123-456');
    expect(encrypt).toHaveBeenCalledWith('서울시');
    // ADR-005
    expect(pool.execute).toHaveBeenCalledTimes(2);
    expect(pool.query).not.toHaveBeenCalled();
    // INSERT params 첫 번째: academyId
    expect(pool.execute.mock.calls[0][1][0]).toBe(1);
    // sync 호출
    expect(syncPeakTrainerAsync).toHaveBeenCalledWith(50);
  });

  test('5xx 한국어 + e.message 누출 X', async () => {
    pool.execute.mockRejectedValueOnce(new Error('FK constraint'));

    const res = await request(makeApp())
      .post('/paca/instructors')
      .send({ name: '홍', phone: '010', salary_type: 'monthly', base_salary: 1000000, tax_type: 'none' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/강사 등록에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/FK constraint/);
  });
});

describe('PUT /paca/instructors/:id', () => {
  beforeEach(() => resetMocks());

  test('강사 미존재 → 404', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).put('/paca/instructors/999').send({ name: '홍' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/강사 정보를 찾을 수 없습니다/);
  });

  test('이메일 중복 → 400 + 한국어 (원본 메시지 보존)', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10 }]])  // 강사 존재
      .mockResolvedValueOnce([[{ id: 11 }]]); // 이메일 중복

    const res = await request(makeApp())
      .put('/paca/instructors/10')
      .send({ email: 'dup@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('이미 사용 중인 이메일입니다.');
  });

  test('변경 항목 0건 → 400 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 10 }]]);

    const res = await request(makeApp()).put('/paca/instructors/10').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/수정할 항목이 없습니다/);
  });

  test('정상 수정 (name + phone) → 암호화 + UPDATE + sync', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10 }]])  // 강사 존재
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE
      .mockResolvedValueOnce([[{ id: 10, name: 'enc:홍길동' }]]);  // SELECT updated

    const res = await request(makeApp())
      .put('/paca/instructors/10')
      .send({ name: '홍길동', phone: '010-9999-8888' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Instructor updated successfully');
    expect(res.body.instructor).toEqual({ id: 10, name: 'enc:홍길동' });
    // 암호화 호출
    expect(encrypt).toHaveBeenCalledWith('홍길동');
    expect(encrypt).toHaveBeenCalledWith('010-9999-8888');
    // ADR-005
    expect(pool.execute).toHaveBeenCalledTimes(3);
    expect(pool.query).not.toHaveBeenCalled();
    // UPDATE SQL 에 name, phone 포함
    expect(pool.execute.mock.calls[1][0]).toMatch(/UPDATE instructors SET .*name = \?, phone = \?, updated_at = NOW\(\) WHERE id = \?/);
    // sync
    expect(syncPeakTrainerAsync).toHaveBeenCalledWith(10);
  });

  test('account_number 변경 시 암호화 적용', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 10 }]]);

    await request(makeApp())
      .put('/paca/instructors/10')
      .send({ account_number: '999-888' });

    expect(encrypt).toHaveBeenCalledWith('999-888');
  });

  test('5xx 한국어 + e.message 누출 X', async () => {
    pool.execute.mockRejectedValueOnce(new Error('lock timeout'));

    const res = await request(makeApp()).put('/paca/instructors/10').send({ name: '홍' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/강사 정보 수정에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/lock timeout/);
  });
});

describe('DELETE /paca/instructors/:id', () => {
  beforeEach(() => resetMocks());

  test('강사 미존재 → 404', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).delete('/paca/instructors/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/강사 정보를 찾을 수 없습니다/);
  });

  test('정상 soft delete → UPDATE deleted_at + sync + 응답 표면 보존', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 10, name: 'enc:홍길동' }]])  // 강사 존재
      .mockResolvedValueOnce([{ affectedRows: 1 }]);  // UPDATE deleted_at

    const res = await request(makeApp()).delete('/paca/instructors/10');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Instructor deleted successfully');
    expect(res.body.instructor).toEqual({ id: 10, name: 'enc:홍길동' });  // name 원본 보존
    // ADR-005
    expect(pool.execute).toHaveBeenCalledTimes(2);
    expect(pool.query).not.toHaveBeenCalled();
    // soft delete SQL
    expect(pool.execute.mock.calls[1][0]).toMatch(/UPDATE instructors SET deleted_at = NOW\(\), updated_at = NOW\(\) WHERE id = \?/);
    // sync
    expect(syncPeakTrainerAsync).toHaveBeenCalledWith(10);
  });

  test('5xx 한국어 + e.message 누출 X', async () => {
    pool.execute.mockRejectedValueOnce(new Error('disk full'));

    const res = await request(makeApp()).delete('/paca/instructors/10');

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/강사 삭제에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/disk full/);
  });
});
