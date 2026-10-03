/** Synthetic academy rows on explicitly isolated MySQL; never connects to production. */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__settlementPaca);
jest.mock('../../config/peak-database', () => global.__settlementPeak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const fs = require('fs');
const express = require('express');
const request = require('supertest');
const { fixture } = require('./max-engine-efficient-fixture');
run('MCP withdrawal financial settlement', () => {
  let f, server, token, day;
  beforeAll(async () => {
    f = await fixture(); global.__settlementPaca = f.paca; global.__settlementPeak = f.peak; day = f.date;
    await f.paca.query('DROP TABLE IF EXISTS max_engine_commands');
    await f.paca.query(fs.readFileSync(require.resolve('../../migrations/20260927_max_engine_commands.sql'), 'utf8'));
    await f.paca.query('DROP TABLE max_engine_payment_settlements');
    await f.paca.query(fs.readFileSync(require.resolve('../../migrations/20261004_max_engine_payment_settlements.sql'), 'utf8'));
    const app = express(); app.use(express.json()); app.use('/full', require('../../routes/integrations/full'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const response = await request(server).post('/full/token').send({ email: 'a@example.invalid', password: 'synthetic' });
    expect(response.status).toBe(200); token = response.body.access_token;
  });
  afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await f?.close(); });
  const post = (path, body) => request(server).post('/full/paca/' + path).auth(token, { type: 'bearer' }).send(body);
  const preview = command => post('preview', command);
  const confirm = p => post('confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true });
  const read = path => request(server).get('/full/paca/' + path).auth(token, { type: 'bearer' });
  const settle = (studentId, settlements) => preview({ operation: 'student_settle', resource_id: studentId, changes: { settlement_date: day, settlements } });
  async function student(id, status = 'withdrawn') {
    await f.insert('paca', 'students', { id, academy_id: 1, name: '합성 정산', status });
  }
  async function bill(id, studentId, paid = '0', final = '300000', extra = {}) {
    await f.insert('paca', 'student_payments', { id, student_id: studentId, academy_id: 1,
      year_month: day.slice(0, 7), payment_type: 'monthly', final_amount: final, paid_amount: paid,
      payment_status: paid === '0' ? 'pending' : paid === final ? 'paid' : 'partial', ...extra });
  }
  const refund = (id, amount, final) => ({ payment_id: id, action: 'refund', refund_amount: amount,
    final_amount: final, refund_completed: true, refund_method: 'cash', reason: '실제 환불 완료' });
  test('withdrawal exposes bills and refuses confirmation before a financial decision', async () => {
    await student(100, 'active'); await bill(100, 100);
    const p = await preview({ operation: 'student_withdraw', resource_id: 100, changes: { withdrawal_date: day } });
    expect(p.status).toBe(200); expect(p.body.after.related.settlement_required).toBe(true);
    expect(p.body.after.related.invoices[0].outstanding).toBe('300000.00');
    const response = await confirm(p.body); expect(response.status).toBe(422); expect(response.body.error.code).toBe('SETTLEMENT_REQUIRED');
    expect((await f.paca.query('SELECT status FROM students WHERE id=100'))[0][0].status).toBe('active');
  });
  test('confirmed withdrawal cancels selected zero-paid bill, preserves another bill and audit rows', async () => {
    await bill(101, 100, '0', '50000');
    const p = await preview({ operation: 'student_withdraw', resource_id: 100, changes: { withdrawal_date: day,
      settlements: [{ payment_id: 100, action: 'cancel', reason: '10월 청구 면제' }] } });
    expect(p.status).toBe(200); expect(p.body.after.related.total_outstanding_after).toBe('50000.00');
    expect((await f.paca.query('SELECT final_amount FROM student_payments WHERE id=100'))[0][0].final_amount).toBe('300000.00');
    expect((await confirm(p.body)).status).toBe(200);
    expect((await f.paca.query('SELECT status FROM students WHERE id=100'))[0][0].status).toBe('withdrawn');
    expect((await f.paca.query('SELECT final_amount,payment_status FROM student_payments WHERE id=100'))[0][0]).toEqual({ final_amount: '0.00', payment_status: 'cancelled' });
    expect((await f.paca.query('SELECT final_amount FROM student_payments WHERE id=101'))[0][0].final_amount).toBe('50000.00');
    const history = await read('resources/payment_settlements?filters=' + encodeURIComponent(JSON.stringify({ student_id: 100 })));
    expect(history.status).toBe(200); expect(history.body.items[0].before_final_amount).toBe('300000.00');
    expect((await read('workflows/unpaid_list?params=' + encodeURIComponent(JSON.stringify({ month: day.slice(0, 7) })))).body.items.some(p => p.id === 100)).toBe(false);
  });
  test('already withdrawn student can reduce remaining tuition, preserve partial receipts and collect the balance', async () => {
    await student(102); await bill(102, 102, '100000', '300000');
    const p = await settle(102, [{ payment_id: 102, action: 'adjust', final_amount: '150000.10', reason: '퇴원일까지 정산' }]);
    expect(p.status).toBe(200); expect(p.body.after.related.payment_changes[0].after.outstanding).toBe('50000.10');
    expect((await confirm(p.body)).status).toBe(200);
    const pay = await preview({ operation: 'payment_pay', resource_id: 102, changes: { paid_amount: '50000.10', payment_date: day, payment_method: 'cash' } });
    expect(pay.status).toBe(200); expect((await confirm(pay.body)).status).toBe(200);
    expect((await f.paca.query('SELECT paid_amount,payment_status FROM student_payments WHERE id=102'))[0][0]).toEqual({ paid_amount: '150000.10', payment_status: 'paid' });
  });
  test('refund records net tuition and an expense exactly once, retaining original income and receipt audit', async () => {
    await student(103); await bill(103, 103, '300000', '300000');
    await f.insert('paca', 'revenues', { academy_id: 1, student_id: 103, payment_id: 103, amount: '300000', revenue_date: day, category: 'tuition' });
    const p = await settle(103, [refund(103, '200000', '100000')]); expect(p.status).toBe(200);
    const results = await Promise.all([confirm(p.body), confirm(p.body)]); expect(results.map(r => r.status)).toEqual([200, 200]);
    expect((await f.paca.query('SELECT final_amount,paid_amount,payment_status FROM student_payments WHERE id=103'))[0][0]).toEqual({ final_amount: '100000.00', paid_amount: '100000.00', payment_status: 'paid' });
    expect((await f.paca.query("SELECT SUM(amount) total,COUNT(*) n FROM expenses WHERE description LIKE '%#103)%'"))[0][0]).toEqual({ total: '200000.00', n: 1 });
    expect((await f.paca.query('SELECT amount FROM revenues WHERE payment_id=103'))[0][0].amount).toBe('300000.00');
    expect((await f.paca.query('SELECT before_paid_amount,after_paid_amount FROM max_engine_payment_settlements WHERE payment_id=103'))[0][0]).toEqual({ before_paid_amount: '300000.00', after_paid_amount: '100000.00' });
    expect((await settle(103, [refund(103, '100001', '0')])).status).toBe(422);
  });
  test('cancel and refund cannot affect other students or academies; source changes invalidate preview', async () => {
    expect((await settle(100, [{ payment_id: 102, action: 'cancel', reason: '다른 학생' }])).status).toBe(404);
    expect((await settle(90, [{ payment_id: 90, action: 'cancel', reason: '외부' }])).status).toBe(404);
    const p = await settle(100, [{ payment_id: 101, action: 'cancel', reason: '면제' }]); expect(p.status).toBe(200);
    await f.paca.query('UPDATE student_payments SET paid_amount=1 WHERE id=101');
    expect((await confirm(p.body)).body.error.code).toBe('SOURCE_CHANGED');
    expect((await f.paca.query('SELECT final_amount FROM student_payments WHERE id=101'))[0][0].final_amount).toBe('50000.00');
  });
  test('refund or audit failure rolls back invoice, expense, withdrawal and command ledger together', async () => {
    await student(104, 'active'); await bill(104, 104, '300000', '300000');
    const p = await preview({ operation: 'student_withdraw', resource_id: 104, changes: { withdrawal_date: day, settlements: [refund(104, '300000', '0')] } });
    expect(p.status).toBe(200);
    await f.paca.query("CREATE TRIGGER reject_settlement BEFORE INSERT ON max_engine_payment_settlements FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'");
    try {
      expect((await confirm(p.body)).status).toBe(503);
      expect((await f.paca.query('SELECT status FROM students WHERE id=104'))[0][0].status).toBe('active');
      expect((await f.paca.query('SELECT paid_amount FROM student_payments WHERE id=104'))[0][0].paid_amount).toBe('300000.00');
      expect((await f.paca.query("SELECT COUNT(*) n FROM expenses WHERE description LIKE '%#104)%'"))[0][0].n).toBe(0);
    } finally { await f.paca.query('DROP TRIGGER reject_settlement'); }
    expect((await confirm(p.body)).status).toBe(200);
  });
  test('season refunds retain enrollment history and update its paid balance alongside invoice', async () => {
    await student(105); await f.insert('paca', 'seasons', { id: 105, academy_id: 1, season_name: '합성 시즌' });
    await f.insert('paca', 'student_seasons', { id: 105, student_id: 105, season_id: 105, season_fee: '300000', paid_amount: '300000', payment_status: 'paid' });
    await bill(105, 105, '300000', '300000', { payment_type: 'season', season_id: 105 });
    const p = await settle(105, [refund(105, '300000', '0')]); expect(p.status).toBe(200); expect((await confirm(p.body)).status).toBe(200);
    expect((await f.paca.query('SELECT paid_amount,refund_amount,is_cancelled,payment_status FROM student_seasons WHERE id=105'))[0][0]).toEqual({ paid_amount: '0.00', refund_amount: '300000.00', is_cancelled: 1, payment_status: 'cancelled' });
  });
  test('attendance cleanup failure after financial writes rolls back the refund and its history', async () => {
    await student(107, 'active'); await bill(107, 107, '300000', '300000');
    await f.insert('paca', 'attendance', { id: 107, student_id: 107, class_schedule_id: 1, attendance_status: 'absent' });
    const p = await preview({ operation: 'student_withdraw', resource_id: 107,
      changes: { withdrawal_date: day, settlements: [refund(107, '300000', '0')] } });
    expect(p.status).toBe(200);
    await f.paca.query("CREATE TRIGGER reject_settlement_attendance BEFORE DELETE ON attendance FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic attendance failure'");
    try {
      expect((await confirm(p.body)).status).toBe(503);
      expect((await f.paca.query('SELECT status FROM students WHERE id=107'))[0][0].status).toBe('active');
      expect((await f.paca.query('SELECT paid_amount FROM student_payments WHERE id=107'))[0][0].paid_amount).toBe('300000.00');
      expect((await f.paca.query('SELECT COUNT(*) n FROM max_engine_payment_settlements WHERE payment_id=107'))[0][0].n).toBe(0);
      expect((await f.paca.query("SELECT COUNT(*) n FROM expenses WHERE description LIKE '%#107)%'"))[0][0].n).toBe(0);
    } finally { await f.paca.query('DROP TRIGGER reject_settlement_attendance'); }
  });
  test('ambiguous season links and invalid refund completion or future dates are refused', async () => {
    await bill(106, 100, '0', '300000', { payment_type: 'season', season_id: null });
    expect((await settle(100, [{ payment_id: 106, action: 'cancel', reason: '시즌 연결 없음' }])).status).toBe(422);
    expect((await settle(103, [{ ...refund(103, '1', '99999'), refund_completed: false }])).status).toBe(422);
    expect((await preview({ operation: 'student_settle', resource_id: 103, changes: { settlement_date: '2999-01-01', settlements: [refund(103, '1', '99999')] } })).status).toBe(422);
  });
  test('gateway-linked partial refunds cannot be deducted twice; remaining invoice can still be adjusted', async () => {
    await student(108); await bill(108, 108, '200000', '300000');
    await f.insert('paca', 'toss_payment_history', { id: 108, academy_id: 1, payment_id: 108 });
    const denied = await settle(108, [refund(108, '100000', '100000')]);
    expect(denied.status).toBe(422); expect(denied.body.error.code).toBe('SETTLEMENT_UNSUPPORTED');
    const p = await settle(108, [{ payment_id: 108, action: 'adjust', final_amount: '200000', reason: '카드 취소 자동 반영 후 청구액 조정' }]);
    expect(p.status).toBe(200); expect(p.body.after.related.invoices[0].gateway_refund_requires_original_screen).toBe(true);
    expect((await confirm(p.body)).status).toBe(200);
    expect((await f.paca.query('SELECT paid_amount,final_amount FROM student_payments WHERE id=108'))[0][0]).toEqual({ paid_amount: '200000.00', final_amount: '200000.00' });
  });
});
