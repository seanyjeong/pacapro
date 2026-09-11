jest.mock('../../config/database', () => require('../helpers/academyEventDatabase').createAcademyEventDatabase());
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { randomBytes } = require('crypto');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const db = require('../../config/database');
const app = express();
app.use(express.json());
app.use('/paca/academy-events', require('../../routes/academyEvents'));
app.use('/paca/public', require('../../routes/public'));
const path = '/paca/academy-events';
const date = '2099-09-11';
const nextDate = '2099-09-12';
const auth = userId => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '5m' })}`;
const create = body => request(app).post(path).set('Authorization', auth(10))
    .send({ title: '운영 회의', event_date: date, ...body });
const update = (id, body) => request(app).put(`${path}/${id}`).set('Authorization', auth(10)).send(body);
const read = id => request(app).get(id ? `${path}/${id}` : path).set('Authorization', auth(10));
const slots = (day = date) => request(app).get(`/paca/public/consultation/test-academy/slots?date=${day}`);

beforeEach(() => db.reset());
afterAll(() => db.close());

test('기본 등록은 차단하지 않으며 공개 상담 예약이 유지된다', async () => {
    const result = await create({});
    expect(result.status).toBe(201);
    expect(result.body.event.block_consultation).toBe(false);
    expect((await read(result.body.event.id)).body.event.block_consultation).toBe(false);
    const availability = await slots();
    expect(availability.status).toBe(200);
    expect(availability.body.slots).toHaveLength(24);
    expect(availability.body.slots.every(slot => slot.available)).toBe(true);
});

test('선택 등록 후 조회·수정에서 상태가 보존되고 끄면 예약이 다시 열린다', async () => {
    const result = await create({ block_consultation: true });
    const id = result.body.event.id;
    expect(result.status).toBe(201);
    expect(result.body.event.block_consultation).toBe(true);
    expect((await read()).body.events[0].block_consultation).toBe(true);
    expect((await slots()).body.slots.every(slot => !slot.available)).toBe(true);
    expect((await update(id, { description: '설명만 수정' })).body.event.block_consultation).toBe(true);
    expect((await update(id, { block_consultation: false })).body.event.block_consultation).toBe(false);
    expect((await slots()).body.slots.every(slot => slot.available)).toBe(true);
    expect((await update(id, { block_consultation: true })).body.event.block_consultation).toBe(true);
});

test('차단된 일정의 날짜와 시간을 바꾸면 이전 차단은 해제되고 새 시간대만 차단된다', async () => {
    const result = await create({ block_consultation: true, is_all_day: false, start_time: '09:00', end_time: '12:00' });
    const before = (await slots()).body.slots;
    expect(before.find(slot => slot.time === '09:00').available).toBe(false);
    expect(before.find(slot => slot.time === '12:00').available).toBe(true);
    const changed = await update(result.body.event.id, {
        event_date: nextDate, start_time: '13:00', end_time: '18:00'
    });
    expect(changed.status).toBe(200);
    expect(changed.body.event.block_consultation).toBe(true);
    expect((await slots()).body.slots.every(slot => slot.available)).toBe(true);
    const after = (await slots(nextDate)).body.slots;
    expect(after.find(slot => slot.time === '12:00').available).toBe(false);
    expect(after.find(slot => slot.time === '18:00').available).toBe(true);
});

test('수업 휴강과 상담 차단은 독립적이며 차단 해제로 휴강이 풀리지 않는다', async () => {
    await db.query('INSERT INTO class_schedules (academy_id, class_date) VALUES (?, ?)', [1, date]);
    const result = await create({ is_holiday: true });
    const id = result.body.event.id;
    expect(result.body.event.block_consultation).toBe(false);
    expect((await db.query('SELECT is_closed FROM class_schedules'))[0][0].is_closed).toBe(1);
    await update(id, { block_consultation: true });
    await update(id, { block_consultation: false });
    expect((await db.query('SELECT is_closed FROM class_schedules'))[0][0].is_closed).toBe(1);
    expect((await slots()).body.slots.every(slot => slot.available)).toBe(true);
    await update(id, { is_holiday: false });
    expect((await db.query('SELECT is_closed FROM class_schedules'))[0][0].is_closed).toBe(0);
});

test('기존 연결 기록에서 차단 상태를 읽고 다른 학원·일정·수동 차단은 보존한다', async () => {
    const result = await create({});
    const id = result.body.event.id;
    await db.query(`INSERT INTO consultation_blocked_slots (academy_id, blocked_date, time_slot, is_all_day, academy_event_id)
        VALUES (1, ?, 'morning', 0, ?), (1, ?, 'evening', 0, NULL), (1, ?, 'afternoon', 0, 999), (2, ?, 'morning', 0, ?)`,
    [date, id, date, date, date, id]);
    expect((await read(id)).body.event.block_consultation).toBe(true);
    expect((await update(id, { block_consultation: false })).status).toBe(200);
    const [remaining] = await db.query('SELECT * FROM consultation_blocked_slots ORDER BY id');
    expect(remaining).toHaveLength(3);
    expect(remaining.map(row => row.academy_event_id)).toEqual([null, 999, id]);
});

test('삭제는 해당 일정의 차단과 휴강만 해제한다', async () => {
    const result = await create({ block_consultation: true, is_holiday: true });
    const deleted = await request(app).delete(`${path}/${result.body.event.id}`).set('Authorization', auth(10));
    expect(deleted.status).toBe(200);
    expect((await read()).body.events).toEqual([]);
    expect((await slots()).body.slots.every(slot => slot.available)).toBe(true);
});

test('저장 도중 실패하면 일정과 차단을 모두 롤백하고 기술 오류를 숨긴다', async () => {
    db.exec(`CREATE TRIGGER fail_block BEFORE INSERT ON consultation_blocked_slots
        WHEN NEW.time_slot = 'afternoon' BEGIN SELECT RAISE(ABORT, 'DB stack trace'); END;`);
    const result = await create({ block_consultation: true });
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toMatch(/DB|stack|SQL|HTTP/i);
    expect((await db.query('SELECT * FROM academy_events'))[0]).toEqual([]);
    expect((await db.query('SELECT * FROM consultation_blocked_slots'))[0]).toEqual([]);
    expect(db.connection.rollback).toHaveBeenCalledTimes(1);
    expect(db.connection.release).toHaveBeenCalledTimes(1);
});

test('중복 차단 충돌이 발생해도 기존 차단의 소유권을 가져오지 않는다', async () => {
    db.exec('CREATE UNIQUE INDEX slot_owner ON consultation_blocked_slots (academy_id, blocked_date, time_slot)');
    await db.query(`INSERT INTO consultation_blocked_slots (academy_id, blocked_date, time_slot, is_all_day, reason)
        VALUES (1, ?, 'afternoon', 0, '직접 차단')`, [date]);
    expect((await create({ block_consultation: true })).status).toBe(500);
    const [remaining] = await db.query('SELECT * FROM consultation_blocked_slots');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ reason: '직접 차단', academy_event_id: null });
});

test('인증·수정 권한과 학원 경계가 유지된다', async () => {
    expect((await request(app).post(path).send({})).status).toBe(401);
    expect((await request(app).post(path).set('Authorization', auth(20)).send({})).status).toBe(403);
    const result = await create({ block_consultation: true });
    await db.query('UPDATE users SET academy_id = 2 WHERE id = 10');
    expect((await update(result.body.event.id, { block_consultation: false })).status).toBe(404);
    expect((await read(result.body.event.id)).status).toBe(404);
    expect((await read()).body.events).toEqual([]);
    expect((await db.query('SELECT * FROM consultation_blocked_slots'))[0]).toHaveLength(3);
    expect(db.connection.commit).toHaveBeenCalledTimes(2);
    expect(db.connection.release).toHaveBeenCalledTimes(2);
});

test.each([
    { block_consultation: 'false' },
    { block_consultation: true, is_all_day: false },
    { block_consultation: true, is_all_day: false, start_time: '18:00', end_time: '12:00' }
])('잘못된 차단 설정은 저장하지 않는다: %j', async body => {
    expect((await create(body)).status).toBe(400);
    expect(db.getConnection).not.toHaveBeenCalled();
});
