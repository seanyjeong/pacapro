/** All writes use a dedicated disposable loopback MySQL; no production credentials. */
jest.mock('../../config/database', () => global.__season.paca);
jest.mock('../../config/peak-database', () => global.__season.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../middleware/auth', () => ({
  verifyToken: (req, _res, next) => { req.user = { academyId: 1, userId: 1, role: 'owner' }; next(); },
  checkPermission: () => (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
}));
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
run('MCP season create/enroll/update/cancel match the PACA season screens', () => {
  let f, app, token, other;
  beforeAll(async () => {
    f = await fixture(); global.__season = f;
    for (const file of ['20260927_max_engine_commands.sql', '20261001_add_season_aftercare.mysql']) {
      const sql = fs.readFileSync(require.resolve('../../migrations/' + file), 'utf8');
      for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await f.paca.query(statement);
    }
    await f.paca.query('ALTER TABLE seasons ADD COLUMN operating_day_slots JSON NULL');
    await f.paca.query('ALTER TABLE student_payments MODIFY paid_amount DECIMAL(10,2) DEFAULT 0, MODIFY carryover_amount DECIMAL(10,2) DEFAULT 0, MODIFY discount_amount DECIMAL(10,2) DEFAULT 0');
    app = express(); app.use(express.json());
    app.use('/full', require('../../routes/integrations/full'));
    app.use('/paca/seasons', require('../../routes/seasons'));
    for (const email of ['a@example.invalid', 'b@example.invalid']) {
      const response = await request(app).post('/full/token').send({ email, password: 'synthetic' });
      expect(response.status).toBe(200);
      if (email[0] === 'a') token = response.body.access_token; else other = response.body.access_token;
    }
  });
  // The command ledger is not a fixture table; leave it empty for the next suite.
  afterAll(async () => { await f?.paca.query('DELETE FROM max_engine_commands'); await f?.close(); });
  const SEASON = { id: 700, academy_id: 1, season_name: '2099 합성수시', season_type: 'early', non_season_end_date: '2099-06-30',
    season_start_date: '2099-07-01', season_end_date: '2099-07-31', operating_days: '[1,2,3,4,5,6]', default_season_fee: 1000000,
    season_monthly_policy: 'season_replaces_monthly', allows_continuous: 1, continuous_discount_type: 'rate', continuous_discount_rate: 10 };
  async function reset({ season = {}, student = {}, paid = null } = {}) {
    for (const table of ['max_engine_commands', 'student_seasons', 'seasons', 'expenses']) await f.paca.query(`DELETE FROM ${table}`);
    await f.paca.query('DELETE FROM attendance WHERE student_id=4');
    await f.paca.query("DELETE FROM class_schedules WHERE class_date BETWEEN '2099-01-01' AND '2099-12-31'");
    await f.paca.query('DELETE FROM student_payments WHERE student_id=4');
    await f.paca.query("UPDATE students SET status=?,student_type=?,class_days='[1,3,5]',monthly_tuition=300000,discount_rate=0,time_slot='evening',is_season_registered=0,current_season_id=NULL,deleted_at=NULL WHERE id=4",
      [student.status || 'active', student.student_type || 'exam']);
    await f.insert('paca', 'seasons', { ...SEASON, status: 'active', ...season });
    await f.insert('paca', 'student_payments', { id: 400, student_id: 4, academy_id: 1, year_month: '2099-07', payment_type: 'monthly', base_amount: 300000,
      final_amount: 300000, paid_amount: 0, due_date: '2099-07-05', payment_status: 'pending' });
    await f.insert('paca', 'class_schedules', { id: 4000, academy_id: 1, class_date: '2099-07-06', time_slot: 'evening' });
    await f.insert('paca', 'attendance', { id: 4000, class_schedule_id: 4000, student_id: 4, attendance_status: null });
    if (paid !== null) {
      await f.insert('paca', 'student_seasons', { id: 4100, student_id: 4, season_id: 700, season_fee: 1000000, registration_date: '2099-06-20', payment_status: 'pending' });
      await f.insert('paca', 'student_payments', { id: 4101, student_id: 4, academy_id: 1, year_month: '2099-07', payment_type: 'season', season_id: 700,
        base_amount: 1000000, final_amount: 1000000, paid_amount: paid, due_date: '2099-07-01', payment_status: paid >= 1000000 ? 'paid' : paid ? 'partial' : 'pending',
        description: '2099 합성수시 시즌비' });
    }
  }
  const post = (path, body, auth = token) => request(app).post('/full/paca/' + path).auth(auth, { type: 'bearer' }).send(body);
  const preview = (operation, resource_id, changes, auth) => post('preview', { operation, ...(resource_id ? { resource_id } : {}), changes }, auth);
  const confirm = (p, auth) => post('confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true }, auth);
  const rows = async (sql) => (await f.paca.query(sql))[0];
  const omit = row => Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'created_at', 'updated_at', 'season_id', 'previous_season_id'].includes(k)));
  async function outcome() {
    return { seasons: (await rows('SELECT * FROM seasons ORDER BY id')).map(omit),
      enrollments: (await rows('SELECT * FROM student_seasons WHERE student_id=4 ORDER BY id')).map(omit),
      payments: (await rows('SELECT * FROM student_payments WHERE student_id=4 ORDER BY payment_type, `year_month`')).map(omit),
      student: (await rows('SELECT status,is_season_registered,(current_season_id IS NOT NULL) AS in_season FROM students WHERE id=4'))[0],
      expenses: (await rows('SELECT academy_id,category,amount,expense_date,description FROM expenses ORDER BY id')),
      schedules: await rows('SELECT cs.class_date,cs.time_slot FROM attendance a JOIN class_schedules cs ON cs.id=a.class_schedule_id WHERE a.student_id=4 ORDER BY cs.class_date,cs.time_slot') };
  }
  async function previewConfirm(operation, resourceId, changes) {
    const before = await outcome();
    const p = await preview(operation, resourceId, changes); expect(p.body.error).toBeUndefined(); expect(p.status).toBe(200);
    expect(await outcome()).toEqual(before);
    const c = await confirm(p.body); expect(c.body.error).toBeUndefined(); expect(c.status).toBe(200);
    const after = await outcome();
    expect((await confirm(p.body)).body).toEqual(c.body); expect(await outcome()).toEqual(after);
    return { p: p.body, c: c.body, after };
  }

  test.each([
    ['active season before start', {}, {}, { registration_date: '2099-06-20' }, 27, 1000000],
    ['upcoming season removes regular attendance', { status: 'upcoming' }, {}, { registration_date: '2099-06-20' }, 0, 1000000],
    ['mid-season join prorates', {}, {}, { registration_date: '2099-07-15' }, 15, null],
    ['paused student defers schedule', {}, { status: 'paused' }, { registration_date: '2099-06-20' }, 1, 1000000],
    ['manual discount and time slots', {}, {}, { registration_date: '2099-06-20', discount_amount: '50000', discount_reason: '형제', time_slots: ['morning', 'evening'] }, 54, 950000],
    ['mid-season join with this student fee and discount', {}, {}, { registration_date: '2099-07-15', season_fee: '900000', discount_amount: '100000' }, 15, null],
    ['monthly kept when season adds to monthly', { season_monthly_policy: 'season_plus_monthly', payment_due_date: '2099-06-25' }, {}, { registration_date: '2099-06-20' }, 27, 1000000],
  ])('enroll %s: preview writes nothing, confirm equals the screen API', async (_label, season, student, changes, attendance, fee) => {
    await reset({ season, student });
    const { p, after } = await previewConfirm('season_enroll', 4, { season_id: 700, ...changes });
    expect(after.schedules).toHaveLength(attendance);
    const bill = Number(after.payments.find(x => x.payment_type === 'season').final_amount);
    if (fee === null) expect(bill).toBeLessThan(1000000); else expect(bill).toBe(fee);
    expect(Number(after.payments.find(x => x.payment_type === 'season').final_amount)).toBe(p.after.related.season_payment.finalAmount);
    expect(after.payments.filter(x => x.payment_type === 'monthly')).toHaveLength(p.after.related.deleted_monthly_payments.length ? 0 : 1);
    await reset({ season, student });
    const ui = await request(app).post('/paca/seasons/700/enroll').send({ student_id: 4, season_fee: 1000000, ...changes });
    expect(ui.status).toBe(201);
    expect(await outcome()).toEqual(after);
  });
  test('no regular class between non-season end and season start; activation assigns the chosen time slots', async () => {
    const gap = async () => {
      await reset({ season: { status: 'upcoming', non_season_end_date: '2099-06-25' } });
      for (const [id, date] of [[4001, '2099-06-24'], [4002, '2099-06-27']]) {
        await f.insert('paca', 'class_schedules', { id, academy_id: 1, class_date: date, time_slot: 'evening' });
        await f.insert('paca', 'attendance', { id, class_schedule_id: id, student_id: 4, attendance_status: null });
      }
    };
    await gap();
    const { p, after } = await previewConfirm('season_enroll', 4, { season_id: 700, registration_date: '2099-06-20', time_slots: ['morning'] });
    expect(p.after.related.schedule).toContain('비시즌 종강 다음 날(2099-06-26)부터 시즌 끝까지 미체크 정규 출결 2건');
    expect(after.schedules).toEqual([{ class_date: '2099-06-24', time_slot: 'evening' }]);
    await gap();
    expect((await request(app).post('/paca/seasons/700/enroll').send({ student_id: 4, season_fee: 1000000, registration_date: '2099-06-20', time_slots: ['morning'] })).status).toBe(201);
    expect(await outcome()).toEqual(after);
    await f.insert('paca', 'class_schedules', { id: 4003, academy_id: 1, class_date: '2099-07-08', time_slot: 'evening' });
    await f.insert('paca', 'attendance', { id: 4003, class_schedule_id: 4003, student_id: 4, attendance_status: null });
    await f.paca.query('UPDATE student_seasons SET is_cancelled=0'); // 운영 기본값 0 — 합성 스키마에는 기본값이 없다
    expect((await request(app).put('/paca/seasons/700').send({ status: 'active' })).status).toBe(200);
    const { schedules } = await outcome();
    expect(schedules[0]).toEqual({ class_date: '2099-06-24', time_slot: 'evening' });
    expect(schedules.slice(1).map(s => s.time_slot)).toEqual(Array(27).fill('morning'));
    expect(schedules.slice(1).every(s => s.class_date >= '2099-07-01')).toBe(true);
  });
  test('continuous discount uses the previous season like the screen', async () => {
    await reset();
    await f.insert('paca', 'seasons', { ...SEASON, id: 699, season_name: '2099 합성봄', season_start_date: '2099-03-01', season_end_date: '2099-03-31', non_season_end_date: '2099-02-28', status: 'ended' });
    await f.insert('paca', 'student_seasons', { id: 4099, student_id: 4, season_id: 699, season_fee: 1000000, registration_date: '2099-02-20', payment_status: 'paid' });
    const { p, after } = await previewConfirm('season_enroll', 4, { season_id: 700, registration_date: '2099-06-20', is_continuous: true });
    expect(p.after.enrollment.previous_season_id).toBe(699); expect(p.after.enrollment.discount_type).toBe('rate');
    await f.paca.query('DELETE FROM student_seasons WHERE id <> 4099'); await f.paca.query("DELETE FROM student_payments WHERE student_id=4 AND payment_type='season'");
    await f.paca.query('DELETE FROM attendance WHERE student_id=4');
    await f.insert('paca', 'student_payments', { id: 400, student_id: 4, academy_id: 1, year_month: '2099-07', payment_type: 'monthly', base_amount: 300000,
      final_amount: 300000, paid_amount: 0, due_date: '2099-07-05', payment_status: 'pending' });
    await f.insert('paca', 'attendance', { id: 4000, class_schedule_id: 4000, student_id: 4, attendance_status: null });
    await f.paca.query('UPDATE students SET is_season_registered=0,current_season_id=NULL WHERE id=4');
    const ui = await request(app).post('/paca/seasons/700/enroll').send({ student_id: 4, season_fee: 1000000, registration_date: '2099-06-20', is_continuous: true, previous_season_id: 699 });
    expect(ui.status).toBe(201);
    expect(await outcome()).toEqual(after);
  });
  test('season create equals the screen API', async () => {
    await reset();
    const input = { season_name: '2100 합성정시', season_type: 'regular', non_season_end_date: '2100-08-31', season_start_date: '2100-09-01',
      season_end_date: '2100-11-30', operating_days: [1, 3, 5], free_lesson_end_date: '2100-12-15', post_free_action: 'graduate',
      default_season_fee: '1200000', payment_due_date: '2100-08-25', grade_time_slots: { 고3: 'evening', N수: ['morning'] },
      allows_continuous: true, continuous_to_season_type: 'early', continuous_discount_type: 'rate', continuous_discount_rate: 5 };
    const { after, c } = await previewConfirm('season_create', null, input);
    expect((await rows(`SELECT academy_id FROM seasons WHERE id=${c.resource_id}`))[0].academy_id).toBe(1);
    await reset();
    expect((await request(app).post('/paca/seasons').send(input)).status).toBe(201);
    expect(await outcome()).toEqual(after);
    for (const bad of [{ season_end_date: '2100-08-15' }, { free_lesson_end_date: '2100-11-01' }]) {
      expect((await preview('season_create', null, { ...input, ...bad })).body.error.code).toBe('SEASON_INVALID');
    }
  });
  test('screen preview amount is the bill the screen enroll creates (mid-season, this student fee, discount)', async () => {
    await reset();
    const query = 'student_id=4&registration_date=2099-07-15&season_fee=900000&discount_amount=100000';
    const shown = await request(app).get(`/paca/seasons/700/preview?${query}`);
    expect(shown.status).toBe(200);
    const due = shown.body.preview.final_calculation.total_due;
    expect(due).toBeGreaterThan(0); expect(due).toBeLessThan(800000);
    expect(shown.body.preview.final_calculation.manual_discount).toBe(100000);
    expect((await request(app).post('/paca/seasons/700/enroll').send({ student_id: 4, season_fee: 900000, registration_date: '2099-07-15', discount_amount: 100000 })).status).toBe(201);
    expect(Number((await outcome()).payments.find(x => x.payment_type === 'season').final_amount)).toBe(due);
  });
  test('enrollment update recalculates like enroll, syncs the unpaid bill, and equals the screen API', async () => {
    const changes = { registration_date: '2099-07-15', season_fee: '900000', discount_amount: '100000', discount_reason: '형제', time_slots: ['afternoon'] };
    await reset({ paid: 0 });
    const { p, after } = await previewConfirm('season_enrollment_update', 4100, changes);
    expect(p.after.related.season_bill_changed).toBe(true);
    const bill = after.payments.find(x => x.payment_type === 'season');
    expect(Number(bill.final_amount)).toBe(p.after.related.season_payment.final_amount);
    expect(Number(after.enrollments[0].season_fee)).toBe(Number(bill.final_amount));
    expect(after.enrollments[0]).toMatchObject({ discount_type: 'manual', discount_reason: '형제', registration_date: '2099-07-15' });
    await reset({ paid: 0 });
    expect((await request(app).put('/paca/seasons/enrollments/4100').send(changes)).status).toBe(200);
    expect(await outcome()).toEqual(after);
    // 같은 입력으로 새로 등록한 청구와 금액이 같다 (일할은 한 번만)
    await reset();
    await request(app).post('/paca/seasons/700/enroll').send({ student_id: 4, season_fee: 900000, registration_date: '2099-07-15', discount_amount: 100000 });
    expect(Number((await outcome()).payments.find(x => x.payment_type === 'season').final_amount)).toBe(Number(bill.final_amount));
  });
  test('paid bill: amount change is refused on both sides, reason-only change still saves', async () => {
    await reset({ paid: 400000 }); const before = await outcome();
    expect((await preview('season_enrollment_update', 4100, { discount_amount: '50000' })).body.error.code).toBe('SEASON_CONFLICT');
    expect((await request(app).put('/paca/seasons/enrollments/4100').send({ discount_amount: '50000' })).status).toBe(409);
    expect(await outcome()).toEqual(before);
    const { after } = await previewConfirm('season_enrollment_update', 4100, { discount_reason: '장학' });
    expect(after.enrollments[0].discount_reason).toBe('장학'); expect(after.payments).toEqual(before.payments);
    await reset({ paid: 400000 });
    expect((await request(app).put('/paca/seasons/enrollments/4100').send({ discount_reason: '장학' })).status).toBe(200);
    expect(await outcome()).toEqual(after);
  });
  test.each([
    ['unpaid', 0, undefined],
    ['partial refund recorded', 400000, '300000'],
    ['paid but no refund', 1000000, '0'],
  ])('cancel %s equals the screen API', async (_label, paid, refund) => {
    const changes = { cancellation_date: '2099-07-10', ...(refund !== undefined ? { refund_amount: refund } : {}) };
    await reset({ paid });
    const { p, after } = await previewConfirm('season_enrollment_cancel', 4100, changes);
    expect(p.after.related.refund_decision_required).toBe(false);
    expect(after.enrollments).toHaveLength(0);
    expect(after.expenses).toHaveLength(Number(refund) > 0 ? 1 : 0);
    // 받은 돈이 없는 청구만 지운다. 일부 납부 청구는 받은 돈으로 닫아 기록을 남긴다
    const seasonBills = after.payments.filter(x => x.payment_type === 'season');
    expect(seasonBills).toHaveLength(paid > 0 ? 1 : 0);
    if (paid > 0) expect(seasonBills[0]).toMatchObject({ final_amount: `${paid}.00`, paid_amount: `${paid}.00`, payment_status: 'paid' });
    await reset({ paid });
    const ui = await request(app).post('/paca/seasons/enrollments/4100/cancel')
      .send({ cancellation_date: '2099-07-10', ...(refund !== undefined ? { final_refund_amount: Number(refund) } : {}) });
    expect(ui.status).toBe(200);
    expect(await outcome()).toEqual(after);
  });
  test('paid cancel needs the owner refund decision; refund cannot exceed paid', async () => {
    await reset({ paid: 400000 }); const before = await outcome();
    const p = await preview('season_enrollment_cancel', 4100, { cancellation_date: '2099-07-10' });
    expect(p.status).toBe(200); expect(p.body.after.related.refund_decision_required).toBe(true);
    expect(p.body.after.related.refund_calculation).toBeTruthy();
    expect((await confirm(p.body)).body.error.code).toBe('SEASON_CONFLICT'); expect(await outcome()).toEqual(before);
    expect((await preview('season_enrollment_cancel', 4100, { refund_amount: '400001' })).body.error.code).toBe('SEASON_INVALID');
  });
  test('scope, status guards, duplicates and stale previews', async () => {
    await reset();
    expect((await preview('season_enroll', 90, { season_id: 700 })).status).toBe(404);        // another academy's student
    expect((await preview('season_enroll', 4, { season_id: 700 }, other)).status).toBe(404);   // another academy's season
    expect((await preview('season_enrollment_cancel', 4100, {}, other)).status).toBe(404);
    for (const student of [{ status: 'withdrawn' }, { student_type: 'adult' }]) {
      await reset({ student }); expect((await preview('season_enroll', 4, { season_id: 700 })).body.error.code).toBe('SEASON_CONFLICT');
    }
    await reset({ season: { status: 'ended' } }); expect((await preview('season_enroll', 4, { season_id: 700 })).body.error.code).toBe('SEASON_CONFLICT');
    await reset({ paid: 0 }); expect((await preview('season_enroll', 4, { season_id: 700, registration_date: '2099-06-20' })).body.error.code).toBe('SEASON_CONFLICT');
    await reset(); expect((await preview('season_enroll', 4, { season_id: 700, is_continuous: true })).body.error.code).toBe('SEASON_INVALID');
    await reset(); const p = await preview('season_enroll', 4, { season_id: 700, registration_date: '2099-06-20' });
    await f.insert('paca', 'student_payments', { student_id: 4, academy_id: 1, year_month: '2099-07', payment_type: 'monthly', base_amount: 1, final_amount: 1, paid_amount: 0, due_date: '2099-07-05', payment_status: 'pending' });
    const before = await outcome();
    expect((await confirm(p.body)).body.error.code).toBe('SOURCE_CHANGED'); expect(await outcome()).toEqual(before);
  });
  test('failure rolls back the whole enrollment; concurrent confirm applies once', async () => {
    await reset(); const before = await outcome();
    const p = await preview('season_enroll', 4, { season_id: 700, registration_date: '2099-06-20' }); expect(p.status).toBe(200);
    await f.paca.query("CREATE TRIGGER season_failure BEFORE INSERT ON student_payments FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic rollback'");
    try { expect((await confirm(p.body)).status).toBe(503); expect(await outcome()).toEqual(before); }
    finally { await f.paca.query('DROP TRIGGER season_failure'); }
    const results = await Promise.all([confirm(p.body), confirm(p.body)]);
    expect(results.map(r => r.status)).toEqual([200, 200]); expect(results[0].body).toEqual(results[1].body);
    expect((await outcome()).enrollments).toHaveLength(1);
  });
});
