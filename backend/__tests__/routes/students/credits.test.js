/**
 * routes/students/credits.js 테스트 (Phase 2 #3, Tier 2 휴식/공결/수동 크레딧)
 *
 * 회귀 보호 범위:
 *   - 6 endpoint × 응답 표면 (ADR-013 보존):
 *       GET /paca/students/:id/rest-credits             → { message, student, credits, pendingTotal }
 *       POST /paca/students/:id/manual-credit            → { message, credit, calculation:{...} }
 *       GET /paca/students/:id/credits                   → { credits }
 *       PUT /paca/students/:id/credits/:creditId         → { message }
 *       DELETE /paca/students/:id/credits/:creditId      → { message }
 *       POST /paca/students/:id/credits/:creditId/apply  → { message, applied_amount, new_final_amount, credit_remaining }
 *   - 에러 응답: { error: '<영문코드>', message: '<한국어 친화>' } (ADR-003)
 *   - DB 호출 패턴 (ADR-005): pool.execute 만 (db.query / pool.query / connection.query 잔존 0건).
 *   - 사용자 노출 detail (e.message 등) 0건 (보안).
 *   - student_payments / rest_credits 만 접촉 (학사 데이터). payments / toss 미접촉 (ADR-007).
 */

// --- mock: DB pool ---
jest.mock('../../../config/database', () => {
  const fakePool = {
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
  };
  return fakePool;
});

// --- mock: 인증 미들웨어 ---
jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 1, userId: 100, role: 'owner' };
    next();
  }),
  checkPermission: jest.fn(() => (req, res, next) => next()),
}));

// --- mock: 암호화 (decrypt 패스스루 — manual-credit 응답 학생명 검증) ---
jest.mock('../../../utils/encryption', () => ({
  decrypt: jest.fn((v) => `복호화_${v}`),
}));

// --- mock: logger ---
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// --- mock: _utils 헬퍼 (truncateToThousands / countClassDaysInPeriod 패스스루) ---
jest.mock('../../../routes/students/_utils', () => ({
  // 1,000원 단위 절사 (실제 동일 로직)
  truncateToThousands: jest.fn((v) => Math.floor(v / 1000) * 1000),
  // 기간/요일 → 수업 횟수 (테스트용 mock — 호출별 ret 지정)
  countClassDaysInPeriod: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { decrypt } = require('../../../utils/encryption');
const _utils = require('../../../routes/students/_utils');

// --- 라우터 mount ---
function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  require('../../../routes/students/credits')(router);
  app.use('/paca/students', router);
  return app;
}

// --- mock 리셋 ---
function resetMocks() {
  pool.execute.mockReset();
  pool.query.mockReset();
  pool.getConnection.mockReset();
  decrypt.mockClear();
  _utils.truncateToThousands.mockClear();
  _utils.countClassDaysInPeriod.mockReset();
}

describe('GET /paca/students/:id/rest-credits', () => {
  beforeEach(resetMocks);

  test('학생 미존재 → 404 + 한국어 메시지', async () => {
    pool.execute.mockResolvedValueOnce([[]]); // students 빈 배열
    const res = await request(makeApp()).get('/paca/students/99/rest-credits');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: '학생 정보를 찾을 수 없습니다.' });
  });

  test('정상: { message, student, credits, pendingTotal } 표면 + pendingTotal 합산', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 7, name: 'enc_홍길동' }]]) // students
      .mockResolvedValueOnce([[
        { id: 1, status: 'pending',  remaining_amount: 30000 },
        { id: 2, status: 'partial',  remaining_amount: 10000 },
        { id: 3, status: 'applied',  remaining_amount: 0 },
        { id: 4, status: 'cancelled',remaining_amount: 50000 }, // 미합산
      ]]);
    const res = await request(makeApp()).get('/paca/students/7/rest-credits');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Found 4 rest credits',
      student: { id: 7, name: 'enc_홍길동' },
      credits: expect.any(Array),
      pendingTotal: 40000, // 30000 (pending) + 10000 (partial)
    });
    expect(res.body.credits).toHaveLength(4);
  });

  test('ADR-005: pool.execute 만 사용 (pool.query / db.query 호출 0건)', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 7, name: 'n' }]]).mockResolvedValueOnce([[]]);
    await request(makeApp()).get('/paca/students/7/rest-credits');
    expect(pool.execute).toHaveBeenCalledTimes(2);
    expect(pool.query).not.toHaveBeenCalled();
    // 학원 격리 SQL: academy_id 바인딩 검증
    expect(pool.execute.mock.calls[0][1]).toEqual([7, 1]);
  });

  test('5xx 한국어 + detail 누출 0건', async () => {
    pool.execute.mockRejectedValueOnce(new Error('connection lost'));
    const res = await request(makeApp()).get('/paca/students/7/rest-credits');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'FETCH_REST_CREDITS_FAILED',
      message: '크레딧 내역을 불러오지 못했습니다.',
    });
    // e.message 누출 검증 (보안)
    expect(JSON.stringify(res.body)).not.toContain('connection lost');
  });
});

describe('POST /paca/students/:id/manual-credit', () => {
  beforeEach(resetMocks);

  test('reason 누락 → 400 한국어', async () => {
    const res = await request(makeApp()).post('/paca/students/7/manual-credit').send({ direct_amount: 5000 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'VALIDATION_ERROR', message: '사유는 필수입니다.' });
  });

  test('입력 모드 셋 다 없음 → 400 한국어', async () => {
    const res = await request(makeApp()).post('/paca/students/7/manual-credit').send({ reason: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('날짜 기간, 회차, 또는 금액을 입력해주세요.');
  });

  test('class_count 범위 초과 → 400 한국어', async () => {
    const res = await request(makeApp()).post('/paca/students/7/manual-credit').send({ class_count: 13, reason: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('회차는 1~12 사이여야 합니다.');
  });

  test('direct_amount 범위 외 → 400 한국어', async () => {
    const res = await request(makeApp()).post('/paca/students/7/manual-credit').send({ direct_amount: 999, reason: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('금액은 1,000원 ~ 10,000,000원 사이의 정수여야 합니다.');
  });

  test('학생 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]); // students 빈
    const res = await request(makeApp()).post('/paca/students/7/manual-credit').send({ direct_amount: 50000, reason: 'x' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: '학생을 찾을 수 없습니다.' });
  });

  test('direct_amount 모드 정상: 입력 금액 그대로 INSERT + 응답 표면 보존', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 7, name: 'enc_x', monthly_tuition: 200000, weekly_count: 2, class_days: [1,3] }]]) // students
      .mockResolvedValueOnce([{ insertId: 555 }]) // INSERT
      .mockResolvedValueOnce([[{ id: 555, credit_amount: 50000 }]]); // SELECT new
    const res = await request(makeApp())
      .post('/paca/students/7/manual-credit')
      .send({ direct_amount: 50000, reason: '시험기간', notes: '추가 메모' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: '복호화_enc_x 학생에게 50,000원 크레딧이 생성되었습니다.',
      credit: { id: 555, credit_amount: 50000 },
      calculation: {
        monthly_tuition: 200000,
        weekly_count: 2,
        per_class_fee: 0, // direct 모드는 계산 X
        class_count: 0,
        class_dates: null,
        total_credit: 50000,
      },
    });
    // INSERT params: 직접 입력 모드는 today (YYYY-MM-DD) 사용 + 회차 0 + 직접입력 노트 표식
    const insertArgs = pool.execute.mock.calls[1];
    expect(insertArgs[0]).toMatch(/INSERT INTO rest_credits/);
    expect(insertArgs[1][0]).toBe(7);              // student_id
    expect(insertArgs[1][1]).toBe(1);              // academy_id
    expect(insertArgs[1][4]).toBe(0);              // rest_days = finalClassCount
    expect(insertArgs[1][5]).toBe(50000);          // credit_amount
    expect(insertArgs[1][6]).toBe(50000);          // remaining_amount
    expect(insertArgs[1][7]).toContain('(직접입력)');
    expect(decrypt).toHaveBeenCalledWith('enc_x'); // ADR-007 헬퍼 시그니처 보존
  });

  test('회차 모드 정상: monthly_tuition / weekly_count 로 계산 + 1,000원 절사', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 7, name: 'enc_y', monthly_tuition: 200000, weekly_count: 2, class_days: [1,3] }]])
      .mockResolvedValueOnce([{ insertId: 777 }])
      .mockResolvedValueOnce([[{ id: 777 }]]);
    const res = await request(makeApp())
      .post('/paca/students/7/manual-credit')
      .send({ class_count: 3, reason: '시험' });
    expect(res.status).toBe(201);
    // perClassFee = truncate(200000 / (2*4)) = truncate(25000) = 25000
    // creditAmount = truncate(25000 * 3) = 75000
    expect(res.body.calculation.per_class_fee).toBe(25000);
    expect(res.body.calculation.class_count).toBe(3);
    expect(res.body.calculation.total_credit).toBe(75000);
    expect(_utils.truncateToThousands).toHaveBeenCalled();
  });

  test('날짜 모드: countClassDaysInPeriod 호출 + 0건 시 400 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 7, name: 'n', monthly_tuition: 200000, weekly_count: 2, class_days: [1,3] }]]);
    _utils.countClassDaysInPeriod.mockReturnValueOnce({ count: 0, dates: [] });
    const res = await request(makeApp())
      .post('/paca/students/7/manual-credit')
      .send({ start_date: '2026-04-01', end_date: '2026-04-02', reason: '시험' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('해당 기간에 수업일이 없습니다.');
    expect(_utils.countClassDaysInPeriod).toHaveBeenCalledWith('2026-04-01', '2026-04-02', [1,3]);
  });

  test('월 수강료 0 + 회차 모드 → 400 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 7, name: 'n', monthly_tuition: 0, weekly_count: 2, class_days: [1] }]]);
    const res = await request(makeApp())
      .post('/paca/students/7/manual-credit')
      .send({ class_count: 2, reason: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('월 수강료가 설정되지 않은 학생입니다.');
  });

  test('5xx + e.message 누출 0건', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 7, name: 'n', monthly_tuition: 200000, weekly_count: 2, class_days: [1] }]])
      .mockRejectedValueOnce(new Error('insert failed mysql 1062'));
    const res = await request(makeApp())
      .post('/paca/students/7/manual-credit')
      .send({ direct_amount: 50000, reason: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'CREATE_CREDIT_FAILED', message: '크레딧 생성에 실패했습니다.' });
    expect(JSON.stringify(res.body)).not.toContain('mysql');
    expect(JSON.stringify(res.body)).not.toContain('1062');
  });
});

describe('GET /paca/students/:id/credits', () => {
  beforeEach(resetMocks);

  test('정상: { credits } 표면 보존', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 1, credit_amount: 30000 }]]);
    const res = await request(makeApp()).get('/paca/students/7/credits');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ credits: [{ id: 1, credit_amount: 30000 }] });
  });

  test('ADR-005: pool.execute 만 + 학원/학생 격리 params', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    await request(makeApp()).get('/paca/students/7/credits');
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.execute.mock.calls[0][1]).toEqual([7, 1]);
  });
});

describe('PUT /paca/students/:id/credits/:creditId', () => {
  beforeEach(resetMocks);

  test('크레딧 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const res = await request(makeApp()).put('/paca/students/7/credits/55').send({ notes: 'x' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: '크레딧을 찾을 수 없습니다.' });
  });

  test("status='applied' 직접 변경 → 400 한국어", async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 55, status: 'pending', credit_amount: 30000 }]]);
    const res = await request(makeApp()).put('/paca/students/7/credits/55').send({ status: 'applied' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toContain("'applied' 상태는");
  });

  test('used 상태 + 금액 변경 시도 → 400 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 55, status: 'used', credit_amount: 30000 }]]);
    const res = await request(makeApp()).put('/paca/students/7/credits/55').send({ credit_amount: 99999 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('이미 사용된 크레딧은 금액을 수정할 수 없습니다.');
  });

  test('업데이트 필드 0개 → 400 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 55, status: 'pending', credit_amount: 30000 }]]);
    const res = await request(makeApp()).put('/paca/students/7/credits/55').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('수정할 내용이 없습니다.');
  });

  test('정상: credit_amount 수정 → remaining_amount 동시 업데이트 + { message } 표면', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 55, status: 'pending', credit_amount: 30000 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(makeApp()).put('/paca/students/7/credits/55').send({ credit_amount: 50000 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '크레딧이 수정되었습니다.' });
    // UPDATE SQL 에 credit_amount = ?, remaining_amount = ? 둘 다 포함
    const updateArgs = pool.execute.mock.calls[1];
    expect(updateArgs[0]).toMatch(/credit_amount = \?, remaining_amount = \?/);
    expect(updateArgs[1]).toEqual([50000, 50000, 55]); // creditId 마지막
  });

  test('ADR-005: pool.execute 만 사용', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 55, status: 'pending', credit_amount: 30000 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await request(makeApp()).put('/paca/students/7/credits/55').send({ notes: 'updated' });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('DELETE /paca/students/:id/credits/:creditId', () => {
  beforeEach(resetMocks);

  test('크레딧 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const res = await request(makeApp()).delete('/paca/students/7/credits/55');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: '크레딧을 찾을 수 없습니다.' });
  });

  test('used 상태 → 400 한국어 (회계 정합성)', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 55, status: 'used' }]]);
    const res = await request(makeApp()).delete('/paca/students/7/credits/55');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('이미 사용된 크레딧은 삭제할 수 없습니다.');
  });

  test('정상: { message } 표면 + ADR-005', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 55, status: 'pending' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(makeApp()).delete('/paca/students/7/credits/55');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: '크레딧이 삭제되었습니다.' });
    expect(pool.execute.mock.calls[1][0]).toMatch(/DELETE FROM rest_credits WHERE id = \?/);
    expect(pool.execute.mock.calls[1][1]).toEqual([55]);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('POST /paca/students/:id/credits/:creditId/apply', () => {
  beforeEach(resetMocks);

  test('year_month 누락 / 형식 불일치 → 400 한국어', async () => {
    let res = await request(makeApp()).post('/paca/students/7/credits/55/apply').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('YYYY-MM');

    res = await request(makeApp()).post('/paca/students/7/credits/55/apply').send({ year_month: '2026/04' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  test('크레딧 미존재 → 404 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const res = await request(makeApp()).post('/paca/students/7/credits/55/apply').send({ year_month: '2026-04' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: '크레딧을 찾을 수 없습니다.' });
  });

  test('이미 applied → 400 한국어', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 55, status: 'applied', remaining_amount: 0, credit_type: 'manual' }]]);
    const res = await request(makeApp()).post('/paca/students/7/credits/55/apply').send({ year_month: '2026-04' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('이미 사용 완료된 크레딧입니다.');
  });

  test('학원비 미존재 → 404 한국어 (year_month 메시지)', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 55, status: 'pending', remaining_amount: 30000, credit_type: 'manual' }]])
      .mockResolvedValueOnce([[]]); // payments 없음
    const res = await request(makeApp()).post('/paca/students/7/credits/55/apply').send({ year_month: '2026-04' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('2026-04 학원비가 없습니다.');
  });

  test('학원비 paid → 400 한국어', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 55, status: 'pending', remaining_amount: 30000, credit_type: 'manual' }]])
      .mockResolvedValueOnce([[{ id: 99, payment_status: 'paid', final_amount: 200000, carryover_amount: 0, notes: null }]]);
    const res = await request(makeApp()).post('/paca/students/7/credits/55/apply').send({ year_month: '2026-04' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('이미 납부 완료된 학원비에는 크레딧을 적용할 수 없습니다.');
  });

  test('정상 (전액 적용): student_payments + rest_credits 둘 다 UPDATE + 응답 표면 보존', async () => {
    pool.execute
      // 크레딧 (remaining_amount 30000)
      .mockResolvedValueOnce([[{ id: 55, status: 'pending', remaining_amount: 30000, credit_type: 'manual' }]])
      // 학원비 (final 200000, carryover 0, notes null)
      .mockResolvedValueOnce([[{ id: 99, payment_status: 'unpaid', final_amount: '200000', carryover_amount: '0', notes: null }]])
      // student_payments UPDATE
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // rest_credits UPDATE
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(makeApp()).post('/paca/students/7/credits/55/apply').send({ year_month: '2026-04' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: '2026-04 학원비에 30,000원 크레딧이 적용되었습니다.',
      applied_amount: 30000,
      new_final_amount: 170000, // 200000 - 30000
      credit_remaining: 0,
    });
    // student_payments UPDATE: carryover, final, rest_credit_id, notes, payment.id
    const paymentUpdate = pool.execute.mock.calls[2];
    expect(paymentUpdate[0]).toMatch(/UPDATE student_payments SET/);
    expect(paymentUpdate[1]).toEqual([30000, 170000, 55, expect.stringContaining('[크레딧 차감]'), 99]);
    expect(paymentUpdate[1][3]).toContain('수동 크레딧 30,000원 차감');
    // rest_credits UPDATE: status='applied' (전액 소진), applied_to_payment_id=99
    const creditUpdate = pool.execute.mock.calls[3];
    expect(creditUpdate[0]).toMatch(/UPDATE rest_credits SET/);
    expect(creditUpdate[1]).toEqual([0, 'applied', 99, 55]);
  });

  test('정상 (부분 적용): 크레딧 잔액 > 학원비 → status="partial"', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 55, status: 'pending', remaining_amount: 100000, credit_type: 'excused' }]])
      .mockResolvedValueOnce([[{ id: 99, payment_status: 'unpaid', final_amount: '30000', carryover_amount: '5000', notes: 'prev' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(makeApp()).post('/paca/students/7/credits/55/apply').send({ year_month: '2026-05' });
    expect(res.status).toBe(200);
    expect(res.body.applied_amount).toBe(30000); // min(100000, 30000)
    expect(res.body.new_final_amount).toBe(0);
    expect(res.body.credit_remaining).toBe(70000);
    // 'excused' → '공결' 라벨 + carryover 누적 (5000 + 30000 = 35000) + notes prepend
    const paymentUpdate = pool.execute.mock.calls[2];
    expect(paymentUpdate[1][0]).toBe(35000);
    expect(paymentUpdate[1][3]).toContain('공결 크레딧 30,000원 차감');
    expect(paymentUpdate[1][3]).toContain('prev\n');
    // rest_credits status = partial
    expect(pool.execute.mock.calls[3][1]).toEqual([70000, 'partial', 99, 55]);
  });

  test('ADR-005: pool.execute 만 + payments / toss 미접촉 보장', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 55, status: 'pending', remaining_amount: 30000, credit_type: 'carryover' }]])
      .mockResolvedValueOnce([[{ id: 99, payment_status: 'unpaid', final_amount: '50000', carryover_amount: '0', notes: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await request(makeApp()).post('/paca/students/7/credits/55/apply').send({ year_month: '2026-04' });
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled(); // 트랜잭션 미사용 (현재 정책)
    // payments / toss / payment_methods 같은 결제 트랜잭션 테이블 미접촉 (SQL 문자열 검사)
    pool.execute.mock.calls.forEach(([sql]) => {
      expect(sql).not.toMatch(/\bFROM payments\b/i);
      expect(sql).not.toMatch(/\bINSERT INTO payments\b/i);
      expect(sql).not.toMatch(/\btoss\b/i);
    });
  });

  test('5xx + e.message 누출 0건', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 55, status: 'pending', remaining_amount: 30000, credit_type: 'manual' }]])
      .mockResolvedValueOnce([[{ id: 99, payment_status: 'unpaid', final_amount: '50000', carryover_amount: '0', notes: null }]])
      .mockRejectedValueOnce(new Error('UPDATE student_payments deadlock detected'));
    const res = await request(makeApp()).post('/paca/students/7/credits/55/apply').send({ year_month: '2026-04' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'APPLY_CREDIT_FAILED', message: '크레딧 적용에 실패했습니다.' });
    expect(JSON.stringify(res.body)).not.toContain('deadlock');
    expect(JSON.stringify(res.body)).not.toContain('student_payments');
  });
});
