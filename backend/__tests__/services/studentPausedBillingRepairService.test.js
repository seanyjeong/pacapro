jest.mock('../../repositories/studentPausedBillingRepairRepository', () => ({ academy: jest.fn(), actor: jest.fn(),
  students: jest.fn(), monthlyPayments: jest.fn(), monthlyAllowed: jest.fn() }));
jest.mock('../../services/studentLifecycleBillingService', () => ({
  validateContext: jest.requireActual('../../models/studentLifecycleBilling').validateContext, preview: jest.fn(), pause: jest.fn(),
}));
const repository = require('../../repositories/studentPausedBillingRepairRepository');
const billing = require('../../services/studentLifecycleBillingService');
const repair = require('../../services/studentPausedBillingRepairService');
const options = { academyId: 1, academyName: '합성 일산', userId: 100 };
const student = id => ({ id, academy_id: 1, status: 'paused', rest_start_date: '2026-05-15', monthly_tuition: '300000.00' });
const bill = (id, amount = '300000.00') => ({ id, payment_status: 'pending', final_amount: amount,
  base_amount: '300000.00', paid_amount: '0.00', discount_amount: '0.00', additional_amount: '0.00', is_prorated: 0 });
let conn;
beforeEach(() => {
  jest.clearAllMocks(); conn = { execute: jest.fn() };
  repository.academy.mockResolvedValue({ id: 1, name: '합성 일산', owner_user_id: 100 });
  repository.actor.mockResolvedValue({ id: 100 }); repository.students.mockResolvedValue([student(101)]);
  repository.monthlyPayments.mockResolvedValue([bill(701)]); repository.monthlyAllowed.mockResolvedValue(true);
  billing.preview.mockResolvedValue({ preview_hash: 'synthetic-source-hash', rows: [{ payment_id: 701, changed: true }],
    summary: { original_amount: 300000, adjusted_amount: 135000 } });
  billing.pause.mockResolvedValue({ action: 'adjusted', adjustedAmount: 135000, paymentIds: [701] });
});
test('repair requires the exact academy name and an authorised actor before planning any student changes', async () => {
  await expect(repair.plan(conn, { ...options, academyName: '다른 교육원' })).rejects.toMatchObject({ code: 'ACADEMY_CHANGED', status: 409 });
  expect(repository.students).not.toHaveBeenCalled();
  repository.actor.mockResolvedValueOnce(null);
  await expect(repair.plan(conn, options)).rejects.toMatchObject({ code: 'REPAIR_ACTOR', status: 403 });
  expect(repository.students).not.toHaveBeenCalled(); expect(billing.preview).not.toHaveBeenCalled();
  expect(conn.execute).not.toHaveBeenCalled();
});
test('an unverified 77000-won legacy bill remains review-only while a proven full bill receives a readonly plan', async () => {
  repository.students.mockResolvedValue([student(101), student(102)]);
  repository.monthlyPayments.mockImplementation(async (_conn, _academy, id) => [bill(id === 101 ? 701 : 702, id === 101 ? '77000.00' : '300000.00')]);
  const plan = await repair.plan(conn, options);
  expect(plan).toMatchObject({ readonly: true, external_refunds: 0, academy_id: 1, actor_id: 100 });
  expect(plan.review).toEqual([expect.objectContaining({ student_id: 101, issues: [{ payment_id: 701, issue: 'original_amount_unverified' }] })]);
  expect(plan.corrections).toHaveLength(1); expect(plan.corrections[0].student_id).toBe(102);
  expect(billing.preview).toHaveBeenCalledTimes(1); expect(billing.pause).not.toHaveBeenCalled();
  expect(conn.execute).not.toHaveBeenCalled();
});
test('a modified plan hash or a changed per-student source hash prevents financial writes', async () => {
  const plan = await repair.plan(conn, options);
  const tampered = JSON.parse(JSON.stringify(plan)); tampered.corrections[0].quote.summary.adjusted_amount = 0;
  await expect(repair.apply(conn, options, tampered)).rejects.toMatchObject({ code: 'SOURCE_CHANGED', status: 409 });
  expect(billing.pause).not.toHaveBeenCalled();
  billing.pause.mockRejectedValueOnce(Object.assign(new Error('synthetic source changed'), { code: 'SOURCE_CHANGED', status: 409 }));
  await expect(repair.apply(conn, options, plan)).rejects.toMatchObject({ code: 'SOURCE_CHANGED', status: 409 });
  expect(billing.pause).toHaveBeenCalledWith(conn, expect.objectContaining({ studentId: 101,
    expectedPreviewHash: 'synthetic-source-hash', previousDate: '2026-05-15', creditType: 'none' }));
  expect(conn.execute).not.toHaveBeenCalled();
});
test('a season policy that excludes monthly fees is reviewed and cannot be silently prorated', async () => {
  repository.monthlyAllowed.mockResolvedValue(false);
  const plan = await repair.plan(conn, options);
  expect(plan.corrections).toEqual([]);
  expect(plan.review).toEqual([expect.objectContaining({ student_id: 101, issue: 'season_monthly_policy_requires_review' })]);
  expect(billing.preview).not.toHaveBeenCalled(); expect(billing.pause).not.toHaveBeenCalled();
  expect(conn.execute).not.toHaveBeenCalled();
});
