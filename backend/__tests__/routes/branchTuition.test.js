/**
 * 반별 학원비 — 반 이동 때 묻기, 반 학원비 적용. 실제 SQL 을 격리된 메모리 DB 에서 실행한다.
 * 충돌 금지: 반 표가 없는 반끼리는 묻지 않고, 묻지 않거나 고르지 않으면 학원비는 그대로, 청구서는 건드리지 않는다.
 */
jest.mock('../../config/database', () => {
    const { DatabaseSync } = require('node:sqlite');
    let database;
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
                INSERT INTO users (id, name, role, academy_id, is_active, approval_status, permissions)
                    VALUES (10, '원장', 'owner', 1, 1, 'approved', NULL), (20, '직원', 'staff', 1, 1, 'approved', NULL),
                           (21, '학생 수정 직원', 'staff', 1, 1, 'approved', '{"students":{"view":true,"edit":true}}'),
                           (30, '다른 원장', 'owner', 2, 1, 'approved', NULL);
                CREATE TABLE academy_settings (id INTEGER PRIMARY KEY, academy_id INTEGER, settings TEXT);
                INSERT INTO academy_settings (academy_id, settings) VALUES
                    (1, '{"exam_tuition":{"weekly_2":250000,"weekly_3":300000},"adult_tuition":{"weekly_3":200000}}');
                CREATE TABLE branches (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT, sort_order INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'active'
                );
                INSERT INTO branches (id, academy_id, name) VALUES (1, 1, '수성'), (2, 2, '다른학원지점');
                CREATE TABLE classes (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, branch_id INTEGER, class_name TEXT,
                    default_time_slot TEXT DEFAULT 'afternoon', class_days TEXT, instructor_id INTEGER, sort_order INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
                    tuition_by_weekly TEXT
                );
                INSERT INTO classes (id, academy_id, branch_id, class_name, tuition_by_weekly) VALUES
                    (8, 1, 1, '정시반', '{"weekly_1":0,"weekly_2":400000,"weekly_3":450000,"weekly_4":0,"weekly_5":0,"weekly_6":0,"weekly_7":0}'),
                    (9, 1, 1, '선행반', NULL),
                    (11, 2, 2, '다른학원반', '{"weekly_3":999000}');
                CREATE TABLE instructors (id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT);
                CREATE TABLE students (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT, status TEXT, student_type TEXT,
                    weekly_count INTEGER, monthly_tuition REAL, discount_rate REAL, final_monthly_tuition REAL,
                    branch_id INTEGER, class_id INTEGER, deleted_at TEXT
                );
                INSERT INTO students (id, academy_id, name, status, student_type, weekly_count, monthly_tuition, discount_rate, final_monthly_tuition, branch_id, class_id) VALUES
                    (1, 1, '가학생', 'active', 'exam', 3, 300000, 10, NULL, 1, 9),
                    (2, 1, '나학생', 'paused', 'exam', 3, 300000, 0, 300000, 1, 9),
                    (3, 1, '다학생', 'active', 'adult', 3, 200000, 0, NULL, NULL, NULL),
                    (4, 1, '라학생', 'active', 'exam', 3, 450000, 0, NULL, 1, 8),
                    (5, 1, '마학생', 'withdrawn', 'exam', 3, 300000, 0, NULL, 1, 9),
                    (6, 1, '바학생', 'active', 'exam', 0, 280000, 0, NULL, 1, 9),
                    (7, 2, '다른학원학생', 'active', 'exam', 3, 300000, 0, NULL, 2, NULL);
                CREATE TABLE student_payments (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, student_id INTEGER, branch_id INTEGER,
                    base_amount REAL, final_amount REAL, updated_at TEXT
                );
                INSERT INTO student_payments (id, academy_id, student_id, base_amount, final_amount, updated_at) VALUES
                    (1, 1, 1, 300000, 270000, 'kept'), (2, 1, 2, 300000, 300000, 'kept');
                CREATE TABLE consultations (id INTEGER PRIMARY KEY, academy_id INTEGER, branch_id INTEGER);
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
const tuition = async id => (await db.query(
    'SELECT class_id, monthly_tuition, discount_rate, final_monthly_tuition FROM students WHERE id = ?', [id]))[0][0];
const payments = async () => (await db.query('SELECT * FROM student_payments ORDER BY id'))[0];
const pick = changes => changes.map(item => [item.student_id, item.current_tuition, item.new_tuition, item.new_final_tuition]);

beforeEach(() => db.reset());
afterAll(() => db.close());

test('반 표가 없는 반끼리 옮기면 묻지 않고 학원비도 그대로다', async () => {
    const preview = await call('post', `${path}/students/tuition-preview`, { student_ids: [3], class_id: 9 });
    expect(preview.status).toBe(200);
    expect(preview.body.changes).toEqual([]);
    const moved = await call('put', `${path}/students`, { student_ids: [3], class_id: 9 });
    expect(moved.body).toEqual({ message: '학생 1명의 지점·반을 바꿨습니다.', updated: 1 });
    expect(await tuition(3)).toEqual({ class_id: 9, monthly_tuition: 200000, discount_rate: 0, final_monthly_tuition: null });
});

test('따로 정한 반으로 옮기면 지금 → 새 금액을 묻고, 묻기만 하고 고르지 않으면 학원비는 그대로다', async () => {
    const preview = await call('post', `${path}/students/tuition-preview`, { student_ids: [1, 2, 3, 4, 6], class_id: 8 });
    expect(preview.status).toBe(200);
    // 4는 이미 그 반, 6은 주 수업 횟수가 없어 표에서 못 찾는다. 성인 3도 반 표는 하나라 반 금액.
    expect(pick(preview.body.changes)).toEqual([[1, 300000, 450000, 405000], [2, 300000, 450000, 450000], [3, 200000, 450000, 450000]]);
    expect(await call('put', `${path}/students`, { student_ids: [1, 2, 3], class_id: 8 })).toHaveProperty('status', 200);
    expect(await tuition(1)).toEqual({ class_id: 8, monthly_tuition: 300000, discount_rate: 10, final_monthly_tuition: null });
    expect(await tuition(2)).toEqual({ class_id: 8, monthly_tuition: 300000, discount_rate: 0, final_monthly_tuition: 300000 });
    expect(await tuition(3)).toMatchObject({ class_id: 8, monthly_tuition: 200000 });
});

test('따로 정한 반에서 기본표 반으로 나가도 물어본다(학원 기본표 금액)', async () => {
    const preview = await call('post', `${path}/students/tuition-preview`, { student_ids: [4], class_id: 9 });
    expect(pick(preview.body.changes)).toEqual([[4, 450000, 300000, 300000]]);
});

test('고른 학생만 새 반 금액으로 바꾸고 할인율은 그대로, 할인 후 금액은 값이 있던 학생만 다시 계산한다', async () => {
    const result = await call('put', `${path}/students`, {
        student_ids: [1, 2, 3], class_id: 8,
        tuition_changes: [{ student_id: 1, new_tuition: 450000 }, { student_id: 2, new_tuition: 450000 }]
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ updated: 3, tuition_updated: 2 });
    expect(await tuition(1)).toEqual({ class_id: 8, monthly_tuition: 450000, discount_rate: 10, final_monthly_tuition: null });
    expect(await tuition(2)).toEqual({ class_id: 8, monthly_tuition: 450000, discount_rate: 0, final_monthly_tuition: 450000 });
    expect(await tuition(3)).toEqual({ class_id: 8, monthly_tuition: 200000, discount_rate: 0, final_monthly_tuition: null });
    // 이미 만든 청구서는 그대로
    expect(await payments()).toEqual([
        { id: 1, academy_id: 1, student_id: 1, branch_id: null, base_amount: 300000, final_amount: 270000, updated_at: 'kept' },
        { id: 2, academy_id: 1, student_id: 2, branch_id: null, base_amount: 300000, final_amount: 300000, updated_at: 'kept' }
    ]);
});

test('묻고 난 뒤 금액이 달라졌으면 반도 학원비도 바꾸지 않는다', async () => {
    const result = await call('put', `${path}/students`, {
        student_ids: [1], class_id: 8, tuition_changes: [{ student_id: 1, new_tuition: 400000 }]
    });
    expect(result.status).toBe(409);
    expect(await tuition(1)).toEqual({ class_id: 9, monthly_tuition: 300000, discount_rate: 10, final_monthly_tuition: null });
});

test('반 학원비를 정하고 적용하면 미리보기에서 확인한 학생만 바뀐다(퇴원생 제외, 청구서 불변)', async () => {
    const saved = await call('put', `${path}/classes/9`, { tuition_by_weekly: { weekly_3: 350000 } });
    expect(saved.status).toBe(200);
    expect(saved.body.class.tuition_by_weekly).toEqual({ weekly_1: 0, weekly_2: 0, weekly_3: 350000, weekly_4: 0, weekly_5: 0, weekly_6: 0, weekly_7: 0 });
    // 표만 바꾸면 학생 학원비는 그대로
    expect(await tuition(1)).toMatchObject({ monthly_tuition: 300000 });

    const preview = await call('get', `${path}/classes/9/tuition-preview`);
    expect(preview.status).toBe(200);
    expect(preview.body.students.map(item => [item.student_id, item.current_tuition, item.new_tuition, item.changed]))
        .toEqual([[1, 300000, 350000, true], [2, 300000, 350000, true], [6, 280000, null, false]]);

    const applied = await call('post', `${path}/classes/9/apply-tuition`, {
        changes: [{ student_id: 1, new_tuition: 350000 }, { student_id: 2, new_tuition: 350000 }]
    });
    expect(applied.status).toBe(200);
    expect(applied.body.updated).toBe(2);
    expect(await tuition(1)).toEqual({ class_id: 9, monthly_tuition: 350000, discount_rate: 10, final_monthly_tuition: null });
    expect(await tuition(2)).toEqual({ class_id: 9, monthly_tuition: 350000, discount_rate: 0, final_monthly_tuition: 350000 });
    expect(await tuition(5)).toMatchObject({ monthly_tuition: 300000 });
    expect(await tuition(6)).toMatchObject({ monthly_tuition: 280000 });
    expect(await tuition(4)).toMatchObject({ monthly_tuition: 450000 });
    expect((await payments()).map(row => [row.base_amount, row.final_amount, row.updated_at]))
        .toEqual([[300000, 270000, 'kept'], [300000, 300000, 'kept']]);
});

test('반 학원비 적용도 미리보기와 금액이 다르거나 그 반 학생이 아니면 아무것도 바꾸지 않는다', async () => {
    expect((await call('post', `${path}/classes/8/apply-tuition`, { changes: [{ student_id: 4, new_tuition: 450000 }] })).status).toBe(409);
    expect((await call('post', `${path}/classes/8/apply-tuition`, { changes: [{ student_id: 1, new_tuition: 450000 }] })).status).toBe(409);
    expect((await call('post', `${path}/classes/8/apply-tuition`, { changes: [] })).status).toBe(400);
    expect(await tuition(1)).toMatchObject({ monthly_tuition: 300000 });
});

test('반 학원비 표는 0 이상 원 단위 숫자만 받고, null 이면 학원 기본표로 돌아간다', async () => {
    for (const bad of [{ weekly_3: -1 }, { weekly_3: '300000' }, { weekly_3: 1.5 }, { weekly_1: 0 }, [300000]]) {
        expect((await call('put', `${path}/classes/8`, { tuition_by_weekly: bad })).status).toBe(400);
    }
    // 다른 칸만 고치면 표는 그대로
    expect((await call('put', `${path}/classes/8`, { class_name: '정시A반' })).body.class.tuition_by_weekly).toMatchObject({ weekly_3: 450000 });
    expect((await call('put', `${path}/classes/8`, { tuition_by_weekly: null })).body.class.tuition_by_weekly).toBeNull();
    const tree = (await call('get', path)).body;
    expect(tree.branches[0].classes.map(item => [item.id, item.tuition_by_weekly])).toEqual([[8, null], [9, null]]);
    // 기본표로 돌아간 반으로의 이동은 이제 묻지 않는다
    expect((await call('post', `${path}/students/tuition-preview`, { student_ids: [1], class_id: 8 })).body.changes).toEqual([]);
});

test('학원비 미리보기·적용은 학생 수정 권한이 있어야 하고, 다른 학원 반·학생은 못 건드린다', async () => {
    expect((await call('get', `${path}/classes/8/tuition-preview`, undefined, 20)).status).toBe(403);
    expect((await call('post', `${path}/classes/8/apply-tuition`, { changes: [] }, 20)).status).toBe(403);
    expect((await call('post', `${path}/students/tuition-preview`, { student_ids: [1], class_id: 8 }, 20)).status).toBe(403);
    expect((await call('get', `${path}/classes/8/tuition-preview`, undefined, 21)).status).toBe(200);
    expect((await call('get', `${path}/classes/11/tuition-preview`)).status).toBe(404);
    expect((await call('post', `${path}/students/tuition-preview`, { student_ids: [7], class_id: 8 })).body.changes).toEqual([]);
    expect((await call('post', `${path}/students/tuition-preview`, { student_ids: [1], class_id: 11 })).status).toBe(404);
});
