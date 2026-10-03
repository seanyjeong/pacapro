const { summary, plan } = require('../models/maxEngineSettlement');
const { commands } = require('../constants/maxEngineCommands');
const invoice = { id: 1, final_amount: '300000.00', paid_amount: '0.00', payment_status: 'pending', payment_type: 'monthly' };
test('zero-paid cancellation retains a zero bill and adjustment leaves exact outstanding cents', () => {
  expect(plan({ action: 'cancel', reason: '면제' }, invoice).after).toEqual({ final_amount: '0.00', paid_amount: '0.00', payment_status: 'cancelled', outstanding: '0.00' });
  const p = plan({ action: 'adjust', final_amount: '100000.10', reason: '정산' }, { ...invoice, paid_amount: '20000.05' });
  expect(p.after.outstanding).toBe('80000.05'); expect(p.after.payment_status).toBe('partial');
});
test('partial and paid receipts cannot be cancelled or reduced below paid without an explicit refund', () => {
  expect(() => plan({ action: 'cancel' }, { ...invoice, paid_amount: '1.00' })).toThrow();
  expect(() => plan({ action: 'adjust', final_amount: '10' }, { ...invoice, paid_amount: '20' })).toThrow();
  expect(() => plan({ action: 'refund', final_amount: '0', refund_amount: '21' }, { ...invoice, paid_amount: '20' })).toThrow();
  expect(() => plan({ action: 'refund', final_amount: '300000', refund_amount: '0' }, invoice)).toThrow();
});
test('refund leaves net paid, waived bill, and refund amounts separate', () => {
  const p = plan({ action: 'refund', final_amount: '100000', refund_amount: '200000', reason: '환불 완료' }, { ...invoice, paid_amount: '300000', payment_status: 'paid' });
  expect(p.after).toEqual({ final_amount: '100000.00', paid_amount: '100000.00', payment_status: 'paid', outstanding: '0.00' });
  expect(p.refund_amount).toBe('200000.00'); expect(p.external_refund_executed_by_tool).toBe(false);
});
test('linked credits, prepaid groups, closed or non-tuition bills fail instead of losing accounting links', () => {
  for (const extra of [{ rest_credit_id: 1 }, { prepaid_group_id: 'group' }, { payment_status: 'cancelled' }, { payment_type: 'product' }, { final_amount: '-1' }]) {
    expect(() => plan({ action: 'cancel' }, { ...invoice, ...extra })).toThrow();
  }
  expect(summary({ ...invoice, payment_status: 'cancelled' }).outstanding).toBe('0.00');
});
test('schema requires real refund completion, refuses duplicate invoices and conflicting preservation', () => {
  const changes = { settlement_date: '2026-10-03', settlements: [{ payment_id: 1, action: 'refund', final_amount: '0', refund_amount: '10', reason: '반환', refund_method: 'cash' }] };
  const schema = commands.student_settle.schema;
  expect(schema.validate(changes, { convert: false }).error).toBeDefined();
  changes.settlements[0].refund_completed = true;
  expect(schema.validate(changes, { convert: false }).error).toBeUndefined();
  expect(schema.validate({ ...changes, settlements: [...changes.settlements, ...changes.settlements] }).error).toBeDefined();
  expect(commands.student_withdraw.schema.validate({ withdrawal_date: '2026-10-03', billing_decision: 'preserve', settlements: changes.settlements }).error).toBeDefined();
});
