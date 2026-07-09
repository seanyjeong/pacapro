/**
 * routes/salaries/calculation.js 테스트 (Phase 2 #5 — salaries 도메인 분리)
 *
 * 회귀 보호 범위:
 *   - 3 endpoint × 응답 표면 (ADR-013):
 *     POST /calculate                          → { message, instructor:{id,name,salary_type}, salary:<calcResult> }
 *     GET  /work-summary/:i/:y                 → { message, instructor:{...9키}, work_summary:{...8키 + daily_breakdown} }
 *     POST /:id/recalculate                    → { message, salary:{...10키} }
 *   - DB 호출 패턴 (ADR-005): pool.execute 만
 *   - 한국어 친화 메시지 (ADR-003) + e.message 누출 0건
 *   - 에러 코드 영문 표준화
 *   - decrypt(instructor.name) 시그니처 보존 (ADR-007)
 *   - calculateInstructorSalary(instructor, work_data, incentive, deduction) 시그니처 보존
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
  calculate4Insurance: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { decrypt } = require('../../../utils/encryption');
const { calculateInstructorSalary, calculate4Insurance } = require('../../../utils/salaryCalculator');

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  require('../../../routes/salaries/calculation')(router);
  app.use('/paca/salaries', router);
  return app;
}

function resetMocks() {
  pool.execute.mockReset();
  pool.query.mockReset();
  decrypt.mockClear();
  calculateInstructorSalary.mockReset();
  calculate4Insurance.mockReset();
}

describe('POST /paca/salaries/calculate', () => {
  beforeEach(() => resetMocks());

  test('필수 항목 누락 → 400 한국어', async () => {
    const res = await request(makeApp()).post('/paca/salaries/calculate').send({ instructor_id: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/필수 항목/);
  });

  test('강사 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp())
      .post('/paca/salaries/calculate')
      .send({ instructor_id: 999, year: 2026, month: 4 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(res.body.message).toMatch(/강사 정보를 찾을 수 없습니다/);
  });

  test('정상 계산 → calculateInstructorSalary 시그니처 보존 + 응답 표면 보존', async () => {
    const instructor = { id: 5, name: 'enc:홍', salary_type: 'monthly', hourly_rate: 0, base_salary: 3000000 };
    const calcResult = { base_amount: 3000000, net_salary: 2700000, tax_amount: 99000 };
    pool.execute.mockResolvedValueOnce([[instructor]]);
    calculateInstructorSalary.mockReturnValueOnce(calcResult);

    const res = await request(makeApp())
      .post('/paca/salaries/calculate')
      .send({
        instructor_id: 5, year: 2026, month: 4,
        incentive_amount: 100000, total_deduction: 50000,
        work_data: { days_worked: 22 }
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/계산이 완료/);
    expect(res.body.instructor).toEqual({ id: 5, name: '홍', salary_type: 'monthly' });
    expect(res.body.salary).toEqual(calcResult);

    // 시그니처 보존: (instructor, work_data, incentive, deduction)
    expect(calculateInstructorSalary).toHaveBeenCalledWith(
      instructor, { days_worked: 22, yearMonth: '2026-04' }, 100000, 50000
    );
  });

  test('5xx 에러 → 한국어 + e.message 누출 0건', async () => {
    pool.execute.mockRejectedValueOnce(new Error('DB pool exhausted'));

    const res = await request(makeApp())
      .post('/paca/salaries/calculate')
      .send({ instructor_id: 5, year: 2026, month: 4 });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('CALCULATE_FAILED');
    expect(res.body.message).toMatch(/계산에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/DB pool exhausted/);
  });
});

describe('GET /paca/salaries/work-summary/:instructorId/:yearMonth', () => {
  beforeEach(() => resetMocks());

  test('잘못된 yearMonth 형식 → 400 한국어', async () => {
    const res = await request(makeApp()).get('/paca/salaries/work-summary/5/2026');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/연월 형식/);
  });

  test('강사 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).get('/paca/salaries/work-summary/999/2026-04');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/강사 정보를 찾을 수 없습니다/);
  });

  test('정상 조회 → instructor 9키 + work_summary 응답 표면 보존', async () => {
    const instructor = {
      id: 5, name: 'enc:홍', salary_type: 'per_class',
      hourly_rate: '20000', base_salary: '0', tax_type: '3.3%',
      morning_class_rate: '50000', afternoon_class_rate: '60000', evening_class_rate: '70000'
    };
    const attendances = [
      { time_slot: 'morning', attendance_status: 'present', check_in_time: '09:00:00', check_out_time: '12:00:00', work_date: '2026-04-01' },
      { time_slot: 'afternoon', attendance_status: 'present', check_in_time: '13:00:00', check_out_time: '17:00:00', work_date: '2026-04-01' },
      { time_slot: 'evening', attendance_status: 'late', check_in_time: null, check_out_time: null, work_date: '2026-04-02' },
    ];
    pool.execute
      .mockResolvedValueOnce([[instructor]])
      .mockResolvedValueOnce([attendances]);

    const res = await request(makeApp()).get('/paca/salaries/work-summary/5/2026-04');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('근무 요약 조회 완료');

    // instructor 9키 보존
    expect(res.body.instructor).toEqual({
      id: 5, name: '홍', salary_type: 'per_class',
      hourly_rate: '20000', base_salary: '0', tax_type: '3.3%',
      morning_class_rate: '50000', afternoon_class_rate: '60000', evening_class_rate: '70000'
    });

    // work_summary 8키 + daily_breakdown
    expect(res.body.work_summary).toMatchObject({
      year_month: '2026-04',
      morning_classes: 1, afternoon_classes: 1, evening_classes: 1,
      total_classes: 3,
      attendance_days: 2
    });
    expect(res.body.work_summary.daily_breakdown).toBeDefined();
    expect(res.body.work_summary.daily_breakdown['2026-04-01']).toEqual(['오전', '오후']);
    expect(res.body.work_summary.daily_breakdown['2026-04-02']).toEqual(['저녁']);

    // total_hours: morning 3 + afternoon 4 + evening default 3 = 10
    expect(res.body.work_summary.total_hours).toBe(10);
  });

  test('5xx 에러 → 한국어 + e.message 누출 0건', async () => {
    pool.execute.mockRejectedValueOnce(new Error('Query timeout'));

    const res = await request(makeApp()).get('/paca/salaries/work-summary/5/2026-04');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('WORK_SUMMARY_FAILED');
    expect(res.body.message).toMatch(/근무 요약을 불러오지 못했습니다/);
    expect(JSON.stringify(res.body)).not.toMatch(/Query timeout/);
  });
});

describe('POST /paca/salaries/:id/recalculate', () => {
  beforeEach(() => resetMocks());

  test('급여 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(makeApp()).post('/paca/salaries/999/recalculate').send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(res.body.message).toMatch(/급여 기록.*찾을 수 없습니다/);
  });

  test('이미 paid → 400 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{
      id: 10, instructor_id: 5, year_month: '2026-04', payment_status: 'paid',
      salary_type: 'monthly', base_salary: 3000000,
      incentive_amount: 0, total_deduction: 0,
      hourly_rate: 0, instructor_tax_type: '3.3%',
      morning_class_rate: 0, afternoon_class_rate: 0, evening_class_rate: 0,
      academy_id: 1
    }]]);

    const res = await request(makeApp()).post('/paca/salaries/10/recalculate').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/이미 지급 완료.*재계산할 수 없습니다/);
  });

  test('per_class 정상 재계산 → UPDATE + 응답 표면 10키 보존', async () => {
    const salaryRow = {
      id: 10, instructor_id: 5, year_month: '2026-04', payment_status: 'pending',
      base_amount: 0, incentive_amount: 50000, total_deduction: 0, tax_amount: 0,
      salary_type: 'per_class',
      hourly_rate: '20000',
      base_salary: '0',
      instructor_tax_type: '3.3%',
      morning_class_rate: '50000', afternoon_class_rate: '60000', evening_class_rate: '70000',
      academy_id: 1
    };
    const attendances = [
      { time_slot: 'morning', attendance_status: 'present', check_in_time: '09:00:00', check_out_time: '12:00:00' },
      { time_slot: 'afternoon', attendance_status: 'present', check_in_time: null, check_out_time: null },
    ];
    pool.execute
      .mockResolvedValueOnce([[salaryRow]])
      .mockResolvedValueOnce([attendances])
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE

    const res = await request(makeApp()).post('/paca/salaries/10/recalculate').send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/재계산되었습니다/);

    // base_amount = 1*50000 + 1*60000 = 110000
    expect(res.body.salary.base_amount).toBe(110000);
    // tax_amount = 110000 * 0.033 = 3630 → floor 3630
    expect(res.body.salary.tax_amount).toBe(3630);
    // net = floor((110000 + 50000 - 0 - 3630) / 10) * 10
    expect(res.body.salary.net_salary).toBe(156370);
    expect(res.body.salary.morning_classes).toBe(1);
    expect(res.body.salary.afternoon_classes).toBe(1);
    expect(res.body.salary.evening_classes).toBe(0);
    expect(res.body.salary.total_classes).toBe(2);

    // ADR-005: 모든 호출 pool.execute
    expect(pool.query).not.toHaveBeenCalled();

    // UPDATE SQL 검증
    const updateCall = pool.execute.mock.calls[2];
    expect(updateCall[0]).toMatch(/UPDATE salary_records/);
    expect(updateCall[1][0]).toBe(110000); // base_amount
    expect(updateCall[1][1]).toBe('3.3%'); // tax_type
    expect(updateCall[1][2]).toBe(3630); // tax_amount
    expect(updateCall[1][3]).toBeNull(); // insurance_details
  });

  test('insurance 정상 재계산 → 2026 계산 상세 저장', async () => {
    const salaryRow = {
      id: 11, instructor_id: 7, year_month: '2026-07', payment_status: 'pending',
      base_amount: 0, incentive_amount: 100000, total_deduction: 0, tax_amount: 0,
      salary_type: 'monthly',
      hourly_rate: '0',
      base_salary: '3000000',
      instructor_tax_type: 'insurance',
      morning_class_rate: '0', afternoon_class_rate: '0', evening_class_rate: '0',
      academy_id: 1
    };
    const insuranceDetails = {
      nationalPension: 147250,
      healthInsurance: 111445,
      longTermCare: 14640,
      employmentInsurance: 27900,
      totalDeduction: 301235,
      netAmount: 2798760
    };
    pool.execute
      .mockResolvedValueOnce([[salaryRow]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    calculate4Insurance.mockReturnValueOnce(insuranceDetails);

    const res = await request(makeApp()).post('/paca/salaries/11/recalculate').send({});

    expect(res.status).toBe(200);
    expect(calculate4Insurance).toHaveBeenCalledWith(3100000, '2026-07');
    expect(res.body.salary.tax_amount).toBe(301235);
    expect(res.body.salary.net_salary).toBe(2798760);

    const updateCall = pool.execute.mock.calls[2];
    expect(updateCall[0]).toMatch(/insurance_details = \?/);
    expect(updateCall[1][0]).toBe(3000000);
    expect(updateCall[1][1]).toBe('insurance');
    expect(updateCall[1][2]).toBe(301235);
    expect(JSON.parse(updateCall[1][3])).toEqual(insuranceDetails);
    expect(updateCall[1][4]).toBe(2798760);
  });

  test('5xx 에러 → 한국어 + e.message 누출 0건', async () => {
    pool.execute.mockRejectedValueOnce(new Error('Lock wait timeout'));

    const res = await request(makeApp()).post('/paca/salaries/10/recalculate').send({});

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('RECALCULATE_FAILED');
    expect(res.body.message).toMatch(/재계산에 실패/);
    expect(JSON.stringify(res.body)).not.toMatch(/Lock wait timeout/);
  });
});
