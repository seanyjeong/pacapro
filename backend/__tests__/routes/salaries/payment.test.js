/**
 * routes/salaries/payment.js 테스트 (Phase 2 #5 — salaries 도메인 분리)
 *
 * 회귀 보호 범위:
 *   - 2 endpoint × 응답 표면 (ADR-013):
 *     POST /bulk-pay        → { message, paid_count, salaries:[{id, instructor_name, net_salary, year_month}] }
 *     POST /:id/pay         → { message, salary: <decryptedRow> }
 *   - DB 호출 패턴 (ADR-005): pool.execute 만
 *   - IN 절 자리표시자 명시 전개 (ADR-016): bulk-pay SELECT + UPDATE 두 군데
 *   - bulk INSERT (expenses) 자리표시자 N×8 명시 전개 (ADR-005 prepared statement 호환)
 *   - 한국어 친화 메시지 (ADR-003) + e.message 누출 0건
 *   - 에러 코드 영문 표준화 (NOT_FOUND / VALIDATION_ERROR / FORBIDDEN / BULK_PAY_FAILED / PAY_FAILED)
 */

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
  execute: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 1, userId: 100, role: 'owner' };
    next();
  }),
  checkPermission: jest.fn(() => (req, res, next) => next()),
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
  decrypt: jest.fn(v => v && v.replace(/^enc:/, '')),
}));
jest.mock('../../../utils/salaryCalculator', () => ({
  calculateInstructorSalary: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  require('../../../routes/salaries/payment')(router);
  app.use('/paca/salaries', router);
  return app;
}

function resetMocks() {
  pool.execute.mockReset();
  pool.query.mockReset();
}

describe('POST /paca/salaries/bulk-pay', () => {
  beforeEach(() => resetMocks());

  test('year_month 와 salary_ids 모두 누락 → 400 한국어', async () => {
    const res = await request(makeApp()).post('/paca/salaries/bulk-pay').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/year_month.*salary_ids|반드시 지정/);
  });

  test('year_month 매칭 0건 → 200 + paid_count 0', async () => {
    pool.execute.mockResolvedValueOnce([[]]); // SELECT empty

    const res = await request(makeApp())
      .post('/paca/salaries/bulk-pay')
      .send({ year_month: '2026-04' });

    expect(res.status).toBe(200);
    expect(res.body.paid_count).toBe(0);
    expect(res.body.salaries).toEqual([]);
    expect(res.body.message).toMatch(/지급 처리할.*없습니다/);
  });

  test('salary_ids 정상 지급 → ADR-016 IN 절 자리표시자 명시 전개', async () => {
    const rows = [
      { id: 11, instructor_id: 5, net_salary: 1000000, year_month: '2026-04', academy_id: 1, instructor_name: 'enc:홍' },
      { id: 12, instructor_id: 6, net_salary: 1500000, year_month: '2026-04', academy_id: 1, instructor_name: 'enc:김' },
      { id: 13, instructor_id: 7, net_salary: 2000000, year_month: '2026-04', academy_id: 1, instructor_name: 'enc:이' },
    ];
    pool.execute
      .mockResolvedValueOnce([rows]) // SELECT IN
      .mockResolvedValueOnce([{ affectedRows: 3 }]) // UPDATE IN
      .mockResolvedValueOnce([{ insertId: 50 }]); // INSERT expenses

    const res = await request(makeApp())
      .post('/paca/salaries/bulk-pay')
      .send({ salary_ids: [11, 12, 13], payment_date: '2026-04-30' });

    expect(res.status).toBe(200);
    expect(res.body.paid_count).toBe(3);
    expect(res.body.salaries).toHaveLength(3);
    expect(res.body.message).toMatch(/3건의 급여가 지급/);

    // ADR-016: SELECT IN 자리표시자 3개 명시 전개
    const selectCall = pool.execute.mock.calls[0];
    expect(selectCall[0]).toMatch(/IN \(\?,\?,\?\)/);
    expect(selectCall[1]).toEqual([11, 12, 13, 1]); // ...salary_ids, academyId

    // ADR-016: UPDATE IN 자리표시자 3개 명시 전개
    const updateCall = pool.execute.mock.calls[1];
    expect(updateCall[0]).toMatch(/IN \(\?,\?,\?\)/);
    expect(updateCall[1]).toEqual(['2026-04-30', 11, 12, 13]);

    // expenses bulk INSERT: VALUES (?,?,?,?,?,?,?,?), (?,...) × 3
    const insertCall = pool.execute.mock.calls[2];
    expect(insertCall[0]).toMatch(/INSERT INTO expenses/);
    // 자리표시자 명시 전개 (3 × 8 = 24개)
    expect(insertCall[1]).toHaveLength(24);
  });

  test('year_month 정상 지급 → 응답 표면 보존', async () => {
    const rows = [
      { id: 21, instructor_id: 8, net_salary: 800000, year_month: '2026-04', academy_id: 1, instructor_name: 'enc:박' },
    ];
    pool.execute
      .mockResolvedValueOnce([rows])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 51 }]);

    const res = await request(makeApp())
      .post('/paca/salaries/bulk-pay')
      .send({ year_month: '2026-04' });

    expect(res.status).toBe(200);
    expect(res.body.paid_count).toBe(1);
    expect(res.body.salaries[0]).toEqual({
      id: 21, instructor_name: 'enc:박', net_salary: 800000, year_month: '2026-04'
    });
  });

  test('5xx 에러 → 한국어 + e.message 누출 0건', async () => {
    pool.execute.mockRejectedValueOnce(new Error('SQL syntax error'));

    const res = await request(makeApp())
      .post('/paca/salaries/bulk-pay')
      .send({ year_month: '2026-04' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('BULK_PAY_FAILED');
    expect(res.body.message).toMatch(/일괄 지급에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/SQL syntax/);
  });
});

describe('POST /paca/salaries/:id/pay', () => {
  beforeEach(() => resetMocks());

  test('급여 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).post('/paca/salaries/999/pay').send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(res.body.message).toMatch(/급여 기록.*찾을 수 없습니다/);
  });

  test('다른 학원 → 403 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 10, instructor_id: 5, net_salary: 1000000, year_month: '2026-04', academy_id: 999, instructor_name: 'enc:홍' }
    ]]);

    const res = await request(makeApp()).post('/paca/salaries/10/pay').send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(res.body.message).toMatch(/접근 권한이 없습니다/);
  });

  test('정상 지급 → UPDATE + expenses INSERT + 응답 표면 보존', async () => {
    const salaryRow = {
      id: 10, instructor_id: 5, net_salary: 1000000, year_month: '2026-04',
      academy_id: 1, instructor_name: 'enc:홍'
    };
    const updatedRow = {
      ...salaryRow, payment_status: 'paid', payment_date: '2026-04-30'
    };
    pool.execute
      .mockResolvedValueOnce([[salaryRow]]) // SELECT
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE salary_records
      .mockResolvedValueOnce([{ insertId: 60 }]) // INSERT expenses
      .mockResolvedValueOnce([[updatedRow]]); // SELECT updated

    const res = await request(makeApp())
      .post('/paca/salaries/10/pay')
      .send({ payment_date: '2026-04-30' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/급여 지급이 등록/);
    expect(res.body.salary.id).toBe(10);
    expect(res.body.salary.instructor_name).toBe('홍'); // decrypted

    // ADR-005 검증: 모든 호출이 pool.execute (pool.query 0건)
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.execute).toHaveBeenCalledTimes(4);
  });

  test('5xx 에러 → 한국어 + e.message 누출 0건', async () => {
    pool.execute.mockRejectedValueOnce(new Error('Connection lost'));

    const res = await request(makeApp()).post('/paca/salaries/10/pay').send({});

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('PAY_FAILED');
    expect(res.body.message).toMatch(/지급 등록에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/Connection lost/);
  });
});
