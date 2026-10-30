/**
 * GET /paca/students/:id/seasons — 학생 상세 시즌 등록 현황의 수정·취소·환불 버튼이 쓰는 값.
 *   - 등록 id(id)·등록 상태(status)를 준다
 *   - 납부 상태·낸 금액은 시즌 화면과 같이 시즌비 청구 기준 요약
 */

jest.mock('../../../config/database', () => ({ execute: jest.fn(), query: jest.fn(), getConnection: jest.fn() }));
jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 1, id: 100, role: 'owner' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next()),
  checkPermission: jest.fn(() => (req, res, next) => next()),
}));
jest.mock('../../../utils/encryption', () => ({ decrypt: jest.fn((v) => v) }));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../services/studentLifecycleBillingService', () => ({ withdraw: jest.fn() }));

const express = require('express');
const { requestWithoutSocket: request } = require('../../helpers/requestWithoutSocket');
const pool = require('../../../config/database');
const registerEnrollmentRoutes = require('../../../routes/students/enrollment');

function buildApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerEnrollmentRoutes(router);
  app.use('/paca/students', router);
  return app;
}

beforeEach(() => pool.execute.mockReset());

test('등록 id·상태를 주고 납부 상태는 시즌비 청구 기준', async () => {
  pool.execute
    .mockResolvedValueOnce([[{ id: 7, name: 'enc-stud' }]])
    .mockResolvedValueOnce([[{
      id: 1, enrollment_id: 1, season_id: 100, status: 'active', season_fee: '300000',
      payment_status: 'pending', paid_amount: '0',
      payment_paid_amount: '100000', payment_final_amount: '300000', payment_record_status: 'partial',
    }]]);
  const res = await request(buildApp()).get('/paca/students/7/seasons');
  expect(res.status).toBe(200);
  const sql = pool.execute.mock.calls[1][0];
  expect(sql).toMatch(/ss\.id,/);
  expect(sql).toMatch(/WHEN ss\.is_cancelled = 1 THEN 'cancelled'/);
  expect(sql).toMatch(/as season_base_fee/);
  expect(res.body.seasons[0]).toMatchObject({
    id: 1, status: 'active', payment_status: 'partial', paid_amount: 100000, final_fee: 300000, remaining_amount: 200000,
  });
  expect(res.body.seasons[0]).not.toHaveProperty('payment_record_status');
});
