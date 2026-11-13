jest.mock('../../config/database', () => {
    const { DatabaseSync } = require('node:sqlite');
    let database;
    // 실제 SQL을 격리된 메모리 DB에서 실행한다.
    const query = jest.fn(async (sql, params = []) => {
        const statement = database.prepare(sql);
        if (/^\s*SELECT/i.test(sql)) return [statement.all(...params)];
        const result = statement.run(...params);
        return [{ insertId: Number(result.lastInsertRowid), affectedRows: Number(result.changes) }];
    });
    const connection = {
        query, execute: query, release: jest.fn(),
        beginTransaction: jest.fn(async () => database.exec('BEGIN')),
        commit: jest.fn(async () => database.exec('COMMIT')),
        rollback: jest.fn(async () => database.exec('ROLLBACK'))
    };
    return {
        query, execute: query, getConnection: jest.fn(async () => connection),
        close: () => database?.close(),
        reset() {
            database?.close();
            database = new DatabaseSync(':memory:');
            database.exec(`
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY, email TEXT, name TEXT, role TEXT, academy_id INTEGER,
                    is_active INTEGER, approval_status TEXT, position TEXT, permissions TEXT,
                    instructor_id INTEGER, deleted_at TEXT
                );
                INSERT INTO users (id, name, role, academy_id, is_active, approval_status)
                    VALUES (10, '원장', 'owner', 1, 1, 'approved'), (20, '직원', 'staff', 1, 1, 'approved'),
                           (30, '다른 원장', 'owner', 2, 1, 'approved');
                CREATE TABLE branches (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT, sort_order INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'active'
                );
                CREATE TABLE classes (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, branch_id INTEGER, class_name TEXT,
                    default_time_slot TEXT DEFAULT 'afternoon', class_days TEXT, sort_order INTEGER DEFAULT 0, status TEXT DEFAULT 'active'
                );
                CREATE TABLE students (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, status TEXT, branch_id INTEGER, class_id INTEGER,
                    deleted_at TEXT
                );
                INSERT INTO students (id, academy_id, status) VALUES
                    (1, 1, 'active'), (2, 1, 'active'), (3, 1, 'paused'), (4, 2, 'active');
                CREATE TABLE student_payments (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, student_id INTEGER, branch_id INTEGER, updated_at TEXT
                );
                INSERT INTO student_payments (id, academy_id, student_id, updated_at) VALUES
                    (1, 1, 1, 'kept'), (2, 1, 2, 'kept');
            `);
        }
    };
});
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { randomBytes } = require('crypto');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const db = require('../../config/database');
const app = express();
app.use(express.json());
app.use('/paca/branches', require('../../routes/branches'));
const path = '/paca/branches';
const auth = userId => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '5m' })}`;
const call = (method, target, body, userId = 10) =>
    request(app)[method](target).set('Authorization', auth(userId)).send(body);
const student = async id => (await db.query('SELECT branch_id, class_id FROM students WHERE id = ?', [id]))[0][0];

beforeEach(() => db.reset());
afterAll(() => db.close());

async function seed() {
    const suseong = (await call('post', path, { name: '수성' })).body.branch.id;
    const chilgok = (await call('post', path, { name: '칠곡' })).body.branch.id;
    const regular = (await call('post', `${path}/${suseong}/classes`, { class_name: '정시반' })).body.class.id;
    const early = (await call('post', `${path}/${suseong}/classes`, { class_name: '수시반', default_time_slot: 'evening' })).body.class.id;
    return { suseong, chilgok, regular, early };
}

test('지점이 없는 학원은 빈 목록을 받는다', async () => {
    const result = await call('get', path);
    expect(result.status).toBe(200);
    expect(result.body.branches).toEqual([]);
    expect(result.body.unassigned).toEqual({ student_count: 3, active_count: 2 });
});

test('지점·반을 만들고 학생을 넣으면 지점별·반별 인원수가 나온다', async () => {
    const { suseong, chilgok, regular, early } = await seed();
    expect((await call('put', `${path}/students`, { student_ids: [1, 3], class_id: regular })).status).toBe(200);
    expect((await call('put', `${path}/students`, { student_ids: [2], branch_id: chilgok })).status).toBe(200);
    expect(await student(1)).toEqual({ branch_id: suseong, class_id: regular });
    expect(await student(2)).toEqual({ branch_id: chilgok, class_id: null });

    const { branches, unassigned } = (await call('get', path)).body;
    expect(branches.map(branch => [branch.name, branch.student_count, branch.active_count]))
        .toEqual([['수성', 2, 1], ['칠곡', 1, 1]]);
    expect(branches[0].classes.map(item => [item.id, item.class_name, item.default_time_slot, item.student_count]))
        .toEqual([[regular, '정시반', 'afternoon', 2], [early, '수시반', 'evening', 0]]);
    expect(unassigned.student_count).toBe(0);
});

test('반을 옮기면 지점이 따라가고, 둘 다 비우면 배정이 풀린다', async () => {
    const { suseong, chilgok, regular } = await seed();
    await call('put', `${path}/students`, { student_ids: [1], class_id: regular });
    // 반을 다른 지점으로 옮기면 그 반 학생의 지점도 같이 바뀐다
    expect((await call('put', `${path}/classes/${regular}`, { branch_id: chilgok })).status).toBe(200);
    expect(await student(1)).toEqual({ branch_id: chilgok, class_id: regular });
    // 반을 주면 같이 보낸 지점 값보다 반의 지점이 우선한다
    await call('put', `${path}/students`, { student_ids: [2], class_id: regular, branch_id: suseong });
    expect(await student(2)).toEqual({ branch_id: chilgok, class_id: regular });
    await call('put', `${path}/students`, { student_ids: [1], branch_id: null, class_id: null });
    expect(await student(1)).toEqual({ branch_id: null, class_id: null });
});

test('지점을 옮기면 그때까지의 청구서는 옮기기 전 지점에 남는다', async () => {
    const { suseong, chilgok, regular } = await seed();
    const payment = async id => (await db.query('SELECT branch_id, updated_at FROM student_payments WHERE id = ?', [id]))[0][0];
    // 처음 배정될 때는 적지 않는다 — 지난 청구서도 그 지점을 따른다
    await call('put', `${path}/students`, { student_ids: [1], class_id: regular });
    await call('put', `${path}/students`, { student_ids: [2], branch_id: suseong });
    expect(await payment(1)).toEqual({ branch_id: null, updated_at: 'kept' });
    // 같은 지점 안에서 반만 바꾸면 그대로
    await call('put', `${path}/students`, { student_ids: [2], class_id: regular });
    expect(await payment(2)).toEqual({ branch_id: null, updated_at: 'kept' });
    // 반이 다른 지점으로 가면 그 반 학생의 청구서에 옮기기 전 지점이 남는다
    await call('put', `${path}/classes/${regular}`, { branch_id: chilgok });
    expect(await payment(1)).toEqual({ branch_id: suseong, updated_at: 'kept' });
    // 다시 옮기거나 배정을 풀어도 처음 적은 지점은 바뀌지 않는다
    await call('put', `${path}/students`, { student_ids: [1], branch_id: null, class_id: null });
    await call('put', `${path}/students`, { student_ids: [1], branch_id: suseong });
    expect(await payment(1)).toEqual({ branch_id: suseong, updated_at: 'kept' });
    expect(await payment(2)).toEqual({ branch_id: suseong, updated_at: 'kept' });
});

test('이름 중복·사용 중 삭제를 막고 빈 것만 지운다', async () => {
    const { suseong, chilgok, regular, early } = await seed();
    expect((await call('post', path, { name: ' 수성 ' })).status).toBe(409);
    expect((await call('post', path, { name: '' })).status).toBe(400);
    expect((await call('post', `${path}/${suseong}/classes`, { class_name: '정시반' })).status).toBe(409);
    expect((await call('post', `${path}/${chilgok}/classes`, { class_name: '정시반' })).status).toBe(201);
    expect((await call('put', `${path}/${chilgok}`, { name: '수성' })).status).toBe(409);
    await call('put', `${path}/students`, { student_ids: [1], class_id: regular });
    expect((await call('delete', `${path}/classes/${regular}`)).status).toBe(409);
    expect((await call('delete', `${path}/${suseong}`)).status).toBe(409);
    expect((await call('delete', `${path}/classes/${early}`)).status).toBe(200);
    expect((await call('put', `${path}/${suseong}`, { name: '수성본원', status: 'inactive' })).body.branch)
        .toMatchObject({ name: '수성본원', status: 'inactive' });
});

test('다른 학원의 지점·반·학생은 건드리지 못하고, 직원은 권한이 있어야 바꾼다', async () => {
    const { suseong, regular } = await seed();
    expect((await call('get', path, undefined, 30)).body.branches).toEqual([]);
    expect((await call('put', `${path}/${suseong}`, { name: '남의 지점' }, 30)).status).toBe(404);
    expect((await call('post', `${path}/${suseong}/classes`, { class_name: '반' }, 30)).status).toBe(404);
    expect((await call('put', `${path}/students`, { student_ids: [4], class_id: regular }, 30)).status).toBe(404);
    // 다른 학원 학생 번호를 섞어 보내도 내 학원 학생만 바뀐다
    expect((await call('put', `${path}/students`, { student_ids: [1, 4], class_id: regular })).body.updated).toBe(1);
    expect(await student(4)).toEqual({ branch_id: null, class_id: null });

    expect((await request(app).get(path)).status).toBe(401);
    expect((await call('get', path, undefined, 20)).status).toBe(200);
    expect((await call('post', path, { name: '복현' }, 20)).status).toBe(403);
    expect((await call('put', `${path}/students`, { student_ids: [1], class_id: regular }, 20)).status).toBe(403);
});

test('반에 수업 요일을 정하면 목록에 순서대로 나오고, 비우거나 잘못된 값은 구분한다', async () => {
    const { regular, early } = await seed();
    expect((await call('post', `${path}/1/classes`, { class_name: '새반' })).body.class.class_days).toEqual([]);
    const saved = await call('put', `${path}/classes/${regular}`, { class_days: [5, 1, 3, 1], default_time_slot: 'evening' });
    expect(saved.status).toBe(200);
    expect(saved.body.class).toMatchObject({ class_days: [1, 3, 5], default_time_slot: 'evening' });
    // 이름만 바꿔도 요일은 그대로
    await call('put', `${path}/classes/${regular}`, { class_name: '정시A반' });
    const classes = (await call('get', path)).body.branches[0].classes;
    expect(classes.find(item => item.id === regular).class_days).toEqual([1, 3, 5]);
    expect(classes.find(item => item.id === early).class_days).toEqual([]);
    for (const bad of [[7], [-1], ['1'], '1,3', [1.5]]) {
        expect((await call('put', `${path}/classes/${regular}`, { class_days: bad })).status).toBe(400);
    }
    expect((await call('put', `${path}/classes/${regular}`, { class_days: [] })).body.class.class_days).toEqual([]);
});
