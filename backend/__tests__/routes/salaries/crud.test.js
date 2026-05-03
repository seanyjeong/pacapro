/**
 * routes/salaries/crud.js 테스트 (Phase 2 #5 — salaries 도메인 분리)
 *
 * 회귀 보호 범위:
 *   - 5 endpoint × 응답 표면 (ADR-013):
 *     GET    /          → { message, salaries:[...] }
 *     GET    /:id       → { salary:{...}, attendance_summary:{...} }
 *     POST   /          → { message, salary:{...} }  (status 201)
 *     PUT    /:id       → { message, salary:{...} }
 *     DELETE /:id       → { message, salary:{id, instructor_name, year_month} }
 *   - DB 호출 패턴 (ADR-005): pool.execute 만
 *   - 한국어 친화 메시지 (ADR-003) + e.message 누출 0건
 *   - 에러 코드 영문 표준화
 *   - decryptInstructorName / decryptSalaryArray 시그니처 보존 (ADR-007)
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
  require('../../../routes/salaries/crud')(router);
  app.use('/paca/salaries', router);
  return app;
}

function resetMocks() {
  pool.execute.mockReset();
  pool.query.mockReset();
}

describe('GET /paca/salaries', () => {
  beforeEach(() => resetMocks());

  test('필터 없이 정상 → salaries 배열 + decryptSalaryArray 호출', async () => {
    const rows = [
      { id: 1, instructor_id: 5, instructor_name: 'enc:홍', year_month: '2026-04', net_salary: 1000000, payment_status: 'paid' },
      { id: 2, instructor_id: 6, instructor_name: 'enc:김', year_month: '2026-04', net_salary: 1500000, payment_status: 'pending' },
    ];
    pool.execute.mockResolvedValueOnce([rows]);

    const res = await request(makeApp()).get('/paca/salaries');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/2건의 급여 기록/);
    expect(res.body.salaries).toHaveLength(2);
    expect(res.body.salaries[0].instructor_name).toBe('홍'); // decrypted
    expect(res.body.salaries[1].instructor_name).toBe('김');

    // ADR-005 + 학원 격리
    expect(pool.query).not.toHaveBeenCalled();
    const call = pool.execute.mock.calls[0];
    expect(call[0]).toMatch(/i\.academy_id = \?/);
    expect(call[1]).toEqual([1]);
  });

  test('instructor_id + year + month + payment_status 필터 → 모두 적용', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp())
      .get('/paca/salaries?instructor_id=5&year=2026&month=4&payment_status=paid');

    expect(res.status).toBe(200);
    const call = pool.execute.mock.calls[0];
    expect(call[0]).toMatch(/AND s\.instructor_id = \?/);
    expect(call[0]).toMatch(/AND s\.`year_month` = \?/);
    expect(call[0]).toMatch(/AND s\.payment_status = \?/);
    expect(call[1]).toEqual([1, 5, '2026-04', 'paid']);
  });

  test('5xx 에러 → 한국어 + e.message 누출 0건', async () => {
    pool.execute.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(makeApp()).get('/paca/salaries');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('FETCH_SALARIES_FAILED');
    expect(res.body.message).toMatch(/급여 목록을 불러오지 못했습니다/);
    expect(JSON.stringify(res.body)).not.toMatch(/Connection refused/);
  });
});

describe('GET /paca/salaries/:id', () => {
  beforeEach(() => resetMocks());

  test('급여 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).get('/paca/salaries/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(res.body.message).toMatch(/급여 기록.*찾을 수 없습니다/);
  });

  test('정상 조회 → salary + attendance_summary 응답 표면 보존', async () => {
    const salaryRow = {
      id: 10, instructor_id: 5, instructor_name: 'enc:홍',
      year_month: '2026-04', net_salary: 1000000,
      salary_type: 'per_class', hourly_rate: 0, base_salary: 0,
      instructor_tax_type: '3.3%',
      morning_class_rate: 50000, afternoon_class_rate: 60000, evening_class_rate: 70000
    };
    const attendances = [
      { work_date: '2026-04-01', time_slot: 'morning', check_in_time: '09:00:00', check_out_time: '12:00:00', attendance_status: 'present', notes: null },
      { work_date: '2026-04-01', time_slot: 'afternoon', check_in_time: '13:00:00', check_out_time: '17:00:00', attendance_status: 'present', notes: null },
    ];
    pool.execute
      .mockResolvedValueOnce([[salaryRow]])
      .mockResolvedValueOnce([attendances]);

    const res = await request(makeApp()).get('/paca/salaries/10');

    expect(res.status).toBe(200);
    // salary 객체 root 키 보존
    expect(res.body.salary.id).toBe(10);
    expect(res.body.salary.instructor_name).toBe('홍'); // decrypted
    // attendance_summary 8키 (work_year_month / attendance_days / total_classes / morning/afternoon/evening / total_hours / daily_breakdown)
    expect(res.body.attendance_summary).toMatchObject({
      work_year_month: '2026-04',
      attendance_days: 1,
      total_classes: 2,
      morning_classes: 1,
      afternoon_classes: 1,
      evening_classes: 0,
      total_hours: 7
    });
    expect(res.body.attendance_summary.daily_breakdown['2026-04-01'].slots).toEqual(['오전', '오후']);
  });

  test('5xx 에러 → 한국어', async () => {
    pool.execute.mockRejectedValueOnce(new Error('SQL error'));

    const res = await request(makeApp()).get('/paca/salaries/10');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('FETCH_SALARY_FAILED');
    expect(res.body.message).toMatch(/급여 정보를 불러오지 못했습니다/);
  });
});

describe('POST /paca/salaries', () => {
  beforeEach(() => resetMocks());

  test('필수 항목 누락 → 400 한국어', async () => {
    const res = await request(makeApp()).post('/paca/salaries').send({ instructor_id: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/필수 항목 누락/);
  });

  test('강사 미존재 → 404', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).post('/paca/salaries').send({
      instructor_id: 999, year_month: '2026-04', base_amount: 1000000,
      tax_type: '3.3%', net_salary: 970000
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/강사 정보를 찾을 수 없습니다/);
  });

  test('중복 → 400 한국어 (year_month 포함)', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 5 }]]) // instructor exists
      .mockResolvedValueOnce([[{ id: 99 }]]); // already exists

    const res = await request(makeApp()).post('/paca/salaries').send({
      instructor_id: 5, year_month: '2026-04', base_amount: 1000000,
      tax_type: '3.3%', net_salary: 970000
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2026-04 급여 기록이 이미 존재/);
  });

  test('정상 등록 → status 201 + salary 응답 표면 보존', async () => {
    const createdRow = {
      id: 50, instructor_id: 5, instructor_name: 'enc:홍',
      year_month: '2026-04', net_salary: 970000, payment_status: 'pending'
    };
    pool.execute
      .mockResolvedValueOnce([[{ id: 5 }]]) // instructor
      .mockResolvedValueOnce([[]]) // no duplicate
      .mockResolvedValueOnce([{ insertId: 50 }]) // INSERT
      .mockResolvedValueOnce([[createdRow]]); // SELECT created

    const res = await request(makeApp()).post('/paca/salaries').send({
      instructor_id: 5, year_month: '2026-04', base_amount: 1000000,
      tax_type: '3.3%', net_salary: 970000,
      incentive_amount: 50000, total_deduction: 30000
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/등록되었습니다/);
    expect(res.body.salary.id).toBe(50);
    expect(res.body.salary.instructor_name).toBe('홍'); // decrypted

    // ADR-005
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('5xx 에러 → 한국어', async () => {
    pool.execute.mockRejectedValueOnce(new Error('Disk full'));

    const res = await request(makeApp()).post('/paca/salaries').send({
      instructor_id: 5, year_month: '2026-04', base_amount: 1000000,
      tax_type: '3.3%', net_salary: 970000
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('CREATE_SALARY_FAILED');
    expect(res.body.message).toMatch(/급여 기록 등록에 실패/);
  });
});

describe('PUT /paca/salaries/:id', () => {
  beforeEach(() => resetMocks());

  test('급여 미존재 → 404', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).put('/paca/salaries/999').send({ incentive_amount: 100 });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/급여 기록.*찾을 수 없습니다/);
  });

  test('다른 학원 → 403 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{
      id: 10, base_amount: 1000000, incentive_amount: 0, total_deduction: 0, tax_amount: 33000,
      academy_id: 999
    }]]);

    const res = await request(makeApp()).put('/paca/salaries/10').send({ incentive_amount: 100 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(res.body.message).toMatch(/접근 권한이 없습니다/);
  });

  test('수정할 항목 0개 → 400 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{
      id: 10, base_amount: 1000000, incentive_amount: 0, total_deduction: 0, tax_amount: 33000,
      academy_id: 1
    }]]);

    const res = await request(makeApp()).put('/paca/salaries/10').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/수정할 항목이 없습니다/);
  });

  test('incentive 변경 → net_salary 자동 재계산 + 응답 표면 보존', async () => {
    const beforeRow = {
      id: 10, base_amount: 1000000, incentive_amount: 0, total_deduction: 0, tax_amount: 33000,
      academy_id: 1
    };
    const updatedRow = {
      id: 10, instructor_id: 5, instructor_name: 'enc:홍',
      year_month: '2026-04', net_salary: 1067000, incentive_amount: 100000
    };
    pool.execute
      .mockResolvedValueOnce([[beforeRow]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
      .mockResolvedValueOnce([[updatedRow]]); // SELECT updated

    const res = await request(makeApp()).put('/paca/salaries/10').send({ incentive_amount: 100000 });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/수정되었습니다/);
    expect(res.body.salary.id).toBe(10);
    expect(res.body.salary.instructor_name).toBe('홍'); // decrypted

    // UPDATE SQL 에 net_salary 포함 (자동 재계산)
    const updateCall = pool.execute.mock.calls[1];
    expect(updateCall[0]).toMatch(/incentive_amount = \?/);
    expect(updateCall[0]).toMatch(/net_salary = \?/);
    // params: [incentive=100000, net_salary, updated_at NOW(), salaryId=10]
    expect(updateCall[1][0]).toBe(100000);
    // net_salary = floor((1000000 + 100000 - 0 - 33000)/10)*10 = floor(1067000/10)*10 = 1067000
    expect(updateCall[1][1]).toBe(1067000);
    expect(updateCall[1][2]).toBe(10); // salaryId
  });

  test('payment_status 만 변경 → net_salary 재계산 X', async () => {
    pool.execute
      .mockResolvedValueOnce([[{
        id: 10, base_amount: 1000000, incentive_amount: 0, total_deduction: 0, tax_amount: 33000,
        academy_id: 1
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 10, instructor_name: 'enc:홍' }]]);

    const res = await request(makeApp()).put('/paca/salaries/10').send({ payment_status: 'paid' });

    expect(res.status).toBe(200);
    const updateCall = pool.execute.mock.calls[1];
    expect(updateCall[0]).not.toMatch(/net_salary = \?/);
  });

  test('5xx 에러 → 한국어', async () => {
    pool.execute.mockRejectedValueOnce(new Error('Lock wait'));

    const res = await request(makeApp()).put('/paca/salaries/10').send({ incentive_amount: 100 });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('UPDATE_SALARY_FAILED');
    expect(res.body.message).toMatch(/수정에 실패/);
  });
});

describe('DELETE /paca/salaries/:id', () => {
  beforeEach(() => resetMocks());

  test('급여 미존재 → 404', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).delete('/paca/salaries/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/급여 기록.*찾을 수 없습니다/);
  });

  test('다른 학원 → 403', async () => {
    pool.execute.mockResolvedValueOnce([[{
      id: 10, academy_id: 999, instructor_name: 'enc:홍', year_month: '2026-04'
    }]]);

    const res = await request(makeApp()).delete('/paca/salaries/10');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  test('정상 삭제 → 응답 표면 보존 (instructor_name 원본 보존, ADR-013)', async () => {
    pool.execute
      .mockResolvedValueOnce([[{
        id: 10, academy_id: 1, instructor_name: 'enc:홍', year_month: '2026-04'
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(makeApp()).delete('/paca/salaries/10');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/삭제되었습니다/);
    expect(res.body.salary).toEqual({
      id: 10,
      instructor_name: 'enc:홍', // 원본 보존 (기존 동작)
      year_month: '2026-04'
    });
  });
});
