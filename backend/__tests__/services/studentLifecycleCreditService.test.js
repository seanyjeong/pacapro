jest.mock('../../config/database', () => ({ execute: jest.fn() }));
const { persist } = require('../../services/studentLifecycleCreditService');
const context = { academyId: 2, studentId: 14, userId: 7, date: '2026-10-07' };
const credit = { credit_amount: 60000, remaining_amount: 60000, credit_type: 'carryover', rest_days: 25,
  rest_start_date: context.date, rest_end_date: '2026-10-31', source_payment_id: 21, existing: false };

test('existing credit is locked within the academy and reused without recalculation or insertion', async () => {
  const row = { id: 9, credit_amount: 164000, remaining_amount: 5000, status: 'partial' };
  const conn = { execute: jest.fn().mockResolvedValue([[row]]) };
  expect(await persist(conn, context, { ...credit, existing: true, id: 9 })).toBe(row);
  expect(conn.execute).toHaveBeenCalledTimes(1);
  expect(conn.execute.mock.calls[0][0]).toMatch(/student_id=\? AND academy_id=\? FOR UPDATE/);
  expect(conn.execute.mock.calls[0][1]).toEqual([9, 14, 2]);
});
test('new authoritative credit stores its exact source, period, amount and remaining money on the caller connection', async () => {
  const row = { id: 9, ...credit, status: 'pending' };
  const conn = { execute: jest.fn(async sql => sql.startsWith('INSERT') ? [{ insertId: 9 }] : [[row]]) };
  expect(await persist(conn, context, credit)).toEqual(row);
  expect(conn.execute.mock.calls[0][0]).toMatch(/INSERT INTO rest_credits/);
  expect(conn.execute.mock.calls[0][1]).toEqual([14, 2, 21, '2026-10-07', '2026-10-31', 25,
    60000, 60000, 'carryover', expect.stringContaining('2026-10-07')]);
  expect(conn.execute.mock.calls[1][1]).toEqual([9, 14, 2]);
  expect(conn.execute.mock.calls.some(([sql]) => /INSERT INTO expenses|INSERT INTO revenues|UPDATE student_payments/.test(sql))).toBe(false);
});
test('null quote makes no writes and invalid zero or fractional new credit fails before SQL', async () => {
  const conn = { execute: jest.fn() };
  expect(await persist(conn, context, null)).toBeNull();
  await expect(persist(conn, context, { ...credit, credit_amount: 0, remaining_amount: 0 }))
    .rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
  await expect(persist(conn, context, { ...credit, credit_amount: 100.25, remaining_amount: 100.25 }))
    .rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
  expect(conn.execute).not.toHaveBeenCalled();
});
