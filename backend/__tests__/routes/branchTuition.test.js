/**
 * 반별 학원비 — 반 이동 때 묻기, 반 학원비 적용. 실제 SQL 을 격리된 메모리 DB 에서 실행한다.
 * 충돌 금지: 반 표가 없는 반끼리는 묻지 않고, 묻지 않거나 고르지 않으면 학원비는 그대로.
 * 바꾸면 이번 달부터의 미납 월 청구도 학생 수정과 같은 함수로 맞추고, 낸 청구·일할 청구·지난 달 청구는 그대로.
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
        reset(months) {
            database?.close();
            database = new DatabaseSync(':memory:');
            // MySQL 함수 대역
            database.function('GREATEST', (a, b) => Math.max(a, b));
            database.function('NOW', () => 'now');
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
                INSERT INTO branches (id, academy_id, name) VALUES (1, 1, '수성'), (2, 2, '다른학원지점'), (3, 1, '칠곡');
                CREATE TABLE classes (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, branch_id INTEGER, class_name TEXT,
                    default_time_slot TEXT DEFAULT 'afternoon', class_days TEXT, instructor_id INTEGER, sort_order INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
                    tuition_by_weekly TEXT, tuition_by_weekly_before TEXT
                );
                INSERT INTO classes (id, academy_id, branch_id, class_name, tuition_by_weekly) VALUES
                    (8, 1, 1, '정시반', '{"weekly_1":0,"weekly_2":400000,"weekly_3":450000,"weekly_4":0,"weekly_5":0,"weekly_6":0,"weekly_7":0}'),
                    (9, 1, 1, '선행반', NULL),
                    (10, 1, 1, '주말반', '{"weekly_1":0,"weekly_2":0,"weekly_3":0}'),
                    (11, 2, 2, '다른학원반', '{"weekly_3":999000}');
                CREATE TABLE instructors (id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT);
                CREATE TABLE students (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT, status TEXT, student_type TEXT,
                    weekly_count INTEGER, monthly_tuition REAL, discount_rate REAL, final_monthly_tuition REAL,
                    branch_id INTEGER, class_id INTEGER, is_trial INTEGER DEFAULT 0, deleted_at TEXT
                );
                INSERT INTO students (id, academy_id, name, status, student_type, weekly_count, monthly_tuition, discount_rate, final_monthly_tuition, branch_id, class_id, is_trial) VALUES
                    (1, 1, '가학생', 'active', 'exam', 3, 300000, 10, NULL, 1, 9, 0),
                    (2, 1, '나학생', 'paused', 'exam', 3, 300000, 0, 300000, 1, 9, 0),
                    (3, 1, '다학생', 'active', 'adult', 3, 200000, 0, NULL, NULL, NULL, 0),
                    (4, 1, '라학생', 'active', 'exam', 3, 450000, 0, NULL, 1, 8, 0),
                    (5, 1, '마학생', 'withdrawn', 'exam', 3, 300000, 0, NULL, 1, 9, 0),
                    (6, 1, '바학생', 'active', 'exam', 0, 280000, 0, NULL, 1, 9, 0),
                    (7, 2, '다른학원학생', 'active', 'exam', 3, 300000, 0, NULL, 2, NULL, 0),
                    (12, 1, '개별금액학생', 'active', 'exam', 3, 280000, 0, NULL, 1, 9, 0),
                    (13, 1, '체험생', 'trial', 'exam', 3, 300000, 0, NULL, 1, 9, 1),
                    (14, 1, '미등록학생', 'pending', 'exam', 3, 300000, 0, NULL, 1, 9, 0),
                    (15, 1, '예비생', 'prospect', 'exam', 3, 300000, 0, NULL, 1, 9, 0),
                    (16, 1, '체험표시재원', 'active', 'exam', 3, 300000, 0, NULL, 1, 9, 1);
                CREATE TABLE student_payments (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, student_id INTEGER, branch_id INTEGER,
                    year_month TEXT, payment_type TEXT, payment_status TEXT, is_prorated INTEGER DEFAULT 0, description TEXT,
                    base_amount REAL, discount_amount REAL DEFAULT 0, additional_amount REAL DEFAULT 0, carryover_amount REAL DEFAULT 0, final_amount REAL,
                    updated_at TEXT
                );
                CREATE TABLE consultations (id INTEGER PRIMARY KEY, academy_id INTEGER, branch_id INTEGER);
                CREATE TABLE seasons (id INTEGER PRIMARY KEY, academy_id INTEGER, branch_id INTEGER);
            `);
            const bill = database.prepare(`INSERT INTO student_payments
                (id, academy_id, student_id, year_month, payment_type, payment_status, is_prorated, description, base_amount, additional_amount, carryover_amount, final_amount, updated_at)
                VALUES (?, 1, ?, ?, 'monthly', ?, ?, ?, ?, ?, ?, ?, 'kept')`);
            // 가학생(할인 10%): 지난 달 미납, 이번 달 미납(추가 5천), 다음 달 미납(크레딧 2만), 이번 달 낸 것, 이번 달 일할
            bill.run(1, 1, months.last, 'pending', 0, '지난 달 학원비', 300000, 0, 0, 270000);
            bill.run(2, 1, months.this, 'pending', 0, '이번 달 학원비', 300000, 5000, 0, 275000);
            bill.run(3, 1, months.next, 'pending', 0, '다음 달 학원비', 300000, 0, 20000, 250000);
            bill.run(4, 1, months.this, 'paid', 0, '낸 학원비', 300000, 0, 0, 270000);
            bill.run(5, 1, months.this, 'pending', 1, '18일 등록, 일할계산', 130000, 0, 0, 117000);
            // 나학생(휴원): 이번 달 미납 — 복귀 때 맞추므로 그대로
            bill.run(6, 2, months.this, 'pending', 0, '이번 달 학원비', 300000, 0, 0, 120000);
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
const { updatePendingPayments } = require('../../routes/students/crud/update/paymentEffects');
const app = express();
app.use(express.json());
app.use('/paca/branches', require('../../routes/branches'));
const path = '/paca/branches';
const auth = userId => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '5m' })}`;
const call = (method, target, body, userId = 10) =>
    request(app)[method](target).set('Authorization', auth(userId)).send(body);
const tuition = async id => (await db.query(
    'SELECT class_id, monthly_tuition, discount_rate, final_monthly_tuition FROM students WHERE id = ?', [id]))[0][0];
const bills = async () => (await db.query('SELECT id, base_amount, final_amount, updated_at FROM student_payments ORDER BY id'))[0];
const pick = changes => changes.map(item => [item.student_id, item.current_tuition, item.new_tuition, item.new_final_tuition]);
const confirm = changes => changes.map(({ student_id, current_tuition, new_tuition }) => ({ student_id, current_tuition, new_tuition }));

const koreaMonth = offset => {
    const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
};
const months = { last: koreaMonth(-1), this: koreaMonth(0), next: koreaMonth(1) };
const untouched = [
    { id: 1, base_amount: 300000, final_amount: 270000, updated_at: 'kept' },
    { id: 4, base_amount: 300000, final_amount: 270000, updated_at: 'kept' },
    { id: 5, base_amount: 130000, final_amount: 117000, updated_at: 'kept' },
    { id: 6, base_amount: 300000, final_amount: 120000, updated_at: 'kept' },
];
const onlyIds = (rows, ids) => rows.filter(row => ids.includes(row.id));

beforeEach(() => db.reset(months));
afterAll(() => db.close());

test('반 표가 없는 반끼리 옮기면 묻지 않고 학원비·청구도 그대로다', async () => {
    const preview = await call('post', `${path}/students/tuition-preview`, { student_ids: [3], class_id: 9 });
    expect(preview.status).toBe(200);
    expect(preview.body.changes).toEqual([]);
    const moved = await call('put', `${path}/students`, { student_ids: [3], class_id: 9 });
    expect(moved.body).toEqual({ message: '학생 1명의 지점·반을 바꿨습니다.', updated: 1 });
    expect(await tuition(3)).toEqual({ class_id: 9, monthly_tuition: 200000, discount_rate: 0, final_monthly_tuition: null });
});

test('따로 정한 반으로 옮기면 지금 → 새 금액과 바뀔 미납 청구를 묻고, 고르지 않으면 학원비·청구는 그대로다', async () => {
    const preview = await call('post', `${path}/students/tuition-preview`, { student_ids: [1, 2, 3, 4, 6, 12, 13, 14, 15, 16], class_id: 8 });
    expect(preview.status).toBe(200);
    // 4는 이미 그 반, 6은 주 수업 횟수가 없어 표에서 못 찾고, 체험·미등록·예비생(13~16)은 대상이 아니다.
    expect(pick(preview.body.changes)).toEqual([
        [1, 300000, 450000, 405000], [2, 300000, 450000, 450000], [3, 200000, 450000, 450000], [12, 280000, 450000, 450000]]);
    const [first, paused] = preview.body.changes;
    expect(first.pending_bills).toEqual([
        { id: 2, year_month: months.this, current_amount: 275000, new_amount: 410000 },
        { id: 3, year_month: months.next, current_amount: 250000, new_amount: 385000 }]);
    expect(paused.pending_bills).toEqual([]);
    // 예전 표(학원 표 30만·성인 20만)와 다른 금액은 개별 금액
    expect(preview.body.changes.map(item => [item.student_id, item.individual])).toEqual([[1, false], [2, false], [3, false], [12, true]]);

    expect((await call('put', `${path}/students`, { student_ids: [1, 2, 3], class_id: 8 })).status).toBe(200);
    expect(await tuition(1)).toEqual({ class_id: 8, monthly_tuition: 300000, discount_rate: 10, final_monthly_tuition: null });
    expect(await tuition(2)).toEqual({ class_id: 8, monthly_tuition: 300000, discount_rate: 0, final_monthly_tuition: 300000 });
    expect((await bills()).every(row => row.updated_at === 'kept')).toBe(true);
});

test('따로 정한 반에서 기본표 반으로 나가도 물어보고, 예전 반 표대로 낸 학생은 개별 금액이 아니다', async () => {
    const preview = await call('post', `${path}/students/tuition-preview`, { student_ids: [4], class_id: 9 });
    expect(pick(preview.body.changes)).toEqual([[4, 450000, 300000, 300000]]);
    expect(preview.body.changes[0].individual).toBe(false);
});

test('고른 학생만 새 반 금액으로 바꾸고, 이번 달부터 미납 월 청구도 학생 수정과 같은 식으로 맞춘다', async () => {
    const preview = (await call('post', `${path}/students/tuition-preview`, { student_ids: [1, 2, 3], class_id: 8 })).body.changes;
    const result = await call('put', `${path}/students`, {
        student_ids: [1, 2, 3], class_id: 8, tuition_changes: confirm(preview.filter(item => item.student_id !== 3))
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ updated: 3, tuition_updated: 2 });
    expect(await tuition(1)).toEqual({ class_id: 8, monthly_tuition: 450000, discount_rate: 10, final_monthly_tuition: null });
    expect(await tuition(2)).toEqual({ class_id: 8, monthly_tuition: 450000, discount_rate: 0, final_monthly_tuition: 450000 });
    expect(await tuition(3)).toEqual({ class_id: 8, monthly_tuition: 200000, discount_rate: 0, final_monthly_tuition: null });
    // 이번 달·다음 달 미납만: 할인 10% 후 405,000 + 추가 금액 / − 크레딧
    expect(onlyIds(await bills(), [2, 3])).toEqual([
        { id: 2, base_amount: 450000, final_amount: 410000, updated_at: 'now' },
        { id: 3, base_amount: 450000, final_amount: 385000, updated_at: 'now' }]);
    // 지난 달·낸 청구·일할 청구·휴원 학생 청구는 그대로
    expect(onlyIds(await bills(), [1, 4, 5, 6])).toEqual(untouched);
});

test('묻고 난 뒤 지금 금액이나 새 금액이 달라졌으면 반도 학원비도 청구도 바꾸지 않는다', async () => {
    const stale = [
        { student_id: 1, current_tuition: 300000, new_tuition: 400000 },
        { student_id: 1, current_tuition: 290000, new_tuition: 450000 },
        { student_id: 1, new_tuition: 450000 },
    ];
    for (const change of stale) {
        expect((await call('put', `${path}/students`, { student_ids: [1], class_id: 8, tuition_changes: [change] })).status).toBe(409);
    }
    expect(await tuition(1)).toEqual({ class_id: 9, monthly_tuition: 300000, discount_rate: 10, final_monthly_tuition: null });
    expect((await bills()).every(row => row.updated_at === 'kept')).toBe(true);
});

test('반 학원비 적용: 미리보기에서 확인한 학생만, 미납 청구까지 같이 바뀐다(퇴원·체험·미등록·예비생 제외)', async () => {
    const saved = await call('put', `${path}/classes/9`, { tuition_by_weekly: { weekly_3: 350000 } });
    expect(saved.status).toBe(200);
    expect(saved.body.class.tuition_by_weekly).toEqual({ weekly_1: 0, weekly_2: 0, weekly_3: 350000, weekly_4: 0, weekly_5: 0, weekly_6: 0, weekly_7: 0 });
    // 표만 바꾸면 학생 학원비·청구는 그대로
    expect(await tuition(1)).toMatchObject({ monthly_tuition: 300000 });
    expect((await bills()).every(row => row.updated_at === 'kept')).toBe(true);

    const preview = await call('get', `${path}/classes/9/tuition-preview`);
    expect(preview.status).toBe(200);
    expect(preview.body.students.map(item => [item.student_id, item.current_tuition, item.new_tuition, item.changed, item.individual]))
        .toEqual([[1, 300000, 350000, true, false], [2, 300000, 350000, true, false], [6, 280000, null, false, false], [12, 280000, 350000, true, true]]);
    expect(preview.body.students[0].pending_bills.map(bill => [bill.id, bill.current_amount, bill.new_amount])).toEqual([[2, 275000, 320000], [3, 250000, 295000]]);

    const chosen = preview.body.students.filter(item => item.changed && !item.individual);
    const applied = await call('post', `${path}/classes/9/apply-tuition`, { changes: confirm(chosen) });
    expect(applied.status).toBe(200);
    expect(applied.body.updated).toBe(2);
    expect(applied.body.message).toBe('학생 2명의 학원비와 미납 월 청구 2건을 바꿨습니다. 낸 청구·일할 청구는 그대로예요.');
    expect(await tuition(1)).toEqual({ class_id: 9, monthly_tuition: 350000, discount_rate: 10, final_monthly_tuition: null });
    expect(await tuition(2)).toEqual({ class_id: 9, monthly_tuition: 350000, discount_rate: 0, final_monthly_tuition: 350000 });
    expect(await tuition(12)).toMatchObject({ monthly_tuition: 280000 });
    for (const id of [5, 13, 14, 15, 16]) expect(await tuition(id)).toMatchObject({ monthly_tuition: 300000 });
    expect(onlyIds(await bills(), [1, 4, 5, 6])).toEqual(untouched);
});

test('반 학원비 적용 뒤 미납 청구 = 학생 수정으로 같은 금액을 넣었을 때, 그 뒤 전화번호만 고쳐 저장해도 청구는 그대로', async () => {
    await call('put', `${path}/classes/9`, { tuition_by_weekly: { weekly_3: 350000 } });
    const preview = (await call('get', `${path}/classes/9/tuition-preview`)).body.students.filter(item => item.student_id === 1);
    await call('post', `${path}/classes/9/apply-tuition`, { changes: confirm(preview) });
    const applied = await bills();
    const stored = { status: 'active', monthly_tuition: '350000.00', discount_rate: '10.00' };
    const studentSave = oldStudent => updatePendingPayments({ pool: db, studentId: 1, academyId: 1, monthlyTuition: 350000, discountRate: 10,
        oldStatus: 'active', oldStudent, updatedStudent: stored });

    // 같은 청구에 학생 수정(학원비 300,000 → 350,000)을 한 결과와 같다
    db.reset(months);
    await studentSave({ monthly_tuition: '300000.00', discount_rate: '10.00' });
    expect(await bills()).toEqual(applied);

    // 전화번호만 고친 저장: 학생 화면은 학원비·할인율을 지금 값 그대로 같이 보낸다 → 청구는 한 줄도 다시 쓰지 않는다
    await db.query("UPDATE student_payments SET updated_at = 'kept'");
    await studentSave({ monthly_tuition: '350000.00', discount_rate: '10.00' });
    expect((await bills()).every(row => row.updated_at === 'kept')).toBe(true);
    expect((await bills()).map(row => [row.id, row.base_amount, row.final_amount]))
        .toEqual(applied.map(row => [row.id, row.base_amount, row.final_amount]));
});

test('반 학원비 적용도 미리보기와 금액이 다르거나 그 반 학생이 아니면 아무것도 바꾸지 않는다', async () => {
    expect((await call('post', `${path}/classes/8/apply-tuition`, { changes: [{ student_id: 4, current_tuition: 450000, new_tuition: 450000 }] })).status).toBe(409);
    expect((await call('post', `${path}/classes/8/apply-tuition`, { changes: [{ student_id: 1, current_tuition: 300000, new_tuition: 450000 }] })).status).toBe(409);
    expect((await call('post', `${path}/classes/8/apply-tuition`, { changes: [] })).status).toBe(400);
    expect(await tuition(1)).toMatchObject({ monthly_tuition: 300000 });
});

test('표를 바꾸면 바로 전 표를 남겨, 예전 표대로 낸 학생은 개별 금액이 아니다', async () => {
    expect((await call('put', `${path}/classes/8`, { tuition_by_weekly: { weekly_3: 500000 } })).status).toBe(200);
    // 다른 칸만 고쳐도 바로 전 표는 그대로
    expect((await call('put', `${path}/classes/8`, { class_name: '정시A반' })).status).toBe(200);
    const preview = (await call('get', `${path}/classes/8/tuition-preview`)).body.students;
    expect(preview.map(item => [item.student_id, item.current_tuition, item.new_tuition, item.individual])).toEqual([[4, 450000, 500000, false]]);
});

test('반 학원비 표는 0 이상 원 단위 숫자만 받고, null 이거나 모두 0원이면 학원 기본표다', async () => {
    for (const bad of [{ weekly_3: -1 }, { weekly_3: '300000' }, { weekly_3: 1.5 }, { weekly_1: 0 }, [300000]]) {
        expect((await call('put', `${path}/classes/8`, { tuition_by_weekly: bad })).status).toBe(400);
    }
    expect((await call('put', `${path}/classes/8`, { class_name: '정시A반' })).body.class.tuition_by_weekly).toMatchObject({ weekly_3: 450000 });
    expect((await call('put', `${path}/classes/8`, { tuition_by_weekly: null })).body.class.tuition_by_weekly).toBeNull();
    const tree = (await call('get', path)).body;
    // 모두 0원으로 저장돼 있던 주말반(10)도 표 없음
    expect(tree.branches[0].classes.map(item => [item.id, item.tuition_by_weekly])).toEqual([[8, null], [9, null], [10, null]]);
    expect((await call('post', `${path}/students/tuition-preview`, { student_ids: [1], class_id: 8 })).body.changes).toEqual([]);
    expect((await call('post', `${path}/students/tuition-preview`, { student_ids: [1], class_id: 10 })).body.changes).toEqual([]);
});

test('시즌이 걸린 지점은 지우지 않는다', async () => {
    await db.query('INSERT INTO seasons (id, academy_id, branch_id) VALUES (1, 1, 3)');
    const blocked = await call('delete', `${path}/3`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toBe('이 지점 시즌이 있어 지울 수 없습니다. 시즌의 지점을 바꾸거나 전 지점으로 돌린 뒤 지워주세요.');
    await db.query('UPDATE seasons SET branch_id = NULL WHERE id = 1');
    expect((await call('delete', `${path}/3`)).status).toBe(200);
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
