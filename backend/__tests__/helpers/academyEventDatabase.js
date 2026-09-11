const { DatabaseSync } = require('node:sqlite');

// 실제 SQL을 격리된 메모리 DB에서 실행한다. MySQL 행 잠금 구문만 SQLite용으로 제거한다.
function createAcademyEventDatabase() {
    let database;
    const query = jest.fn(async (sql, params = []) => {
        const statement = database.prepare(sql.replace(/ FOR UPDATE\s*$/, ''));
        const values = params.map(value => typeof value === 'boolean' ? Number(value) : value);
        if (/^\s*SELECT/i.test(sql)) return [statement.all(...values)];
        const result = statement.run(...values);
        return [{ insertId: Number(result.lastInsertRowid), affectedRows: Number(result.changes) }];
    });
    const connection = {
        query, execute: query,
        beginTransaction: jest.fn(async () => database.exec('BEGIN')),
        commit: jest.fn(async () => database.exec('COMMIT')),
        rollback: jest.fn(async () => database.exec('ROLLBACK')),
        release: jest.fn()
    };
    return {
        query, execute: query, connection,
        getConnection: jest.fn(async () => connection),
        exec: sql => database.exec(sql),
        close: () => database?.close(),
        reset() {
            database?.close();
            database = new DatabaseSync(':memory:');
            database.exec(`
                CREATE TABLE academy_events (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, title TEXT, description TEXT,
                    event_type TEXT, event_date TEXT, start_time TEXT, end_time TEXT,
                    is_all_day INTEGER, is_holiday INTEGER, color TEXT, created_by INTEGER
                );
                CREATE TABLE consultation_blocked_slots (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, blocked_date TEXT, time_slot TEXT,
                    is_all_day INTEGER DEFAULT 1, start_time TEXT, end_time TEXT,
                    reason TEXT, blocked_by TEXT, academy_event_id INTEGER
                );
                CREATE TABLE class_schedules (
                    id INTEGER PRIMARY KEY, academy_id INTEGER, class_date TEXT,
                    is_closed INTEGER DEFAULT 0, close_reason TEXT, academy_event_id INTEGER
                );
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY, email TEXT, name TEXT, role TEXT, academy_id INTEGER,
                    is_active INTEGER, approval_status TEXT, position TEXT, permissions TEXT,
                    instructor_id INTEGER, deleted_at TEXT
                );
                INSERT INTO users (id, name, role, academy_id, is_active, approval_status)
                    VALUES (10, '원장', 'owner', 1, 1, 'approved'), (20, '직원', 'staff', 1, 1, 'approved');
                CREATE TABLE academies (id INTEGER PRIMARY KEY, slug TEXT);
                INSERT INTO academies VALUES (1, 'test-academy');
                CREATE TABLE consultation_settings (
                    academy_id INTEGER, slot_duration INTEGER, max_reservations_per_slot INTEGER,
                    is_enabled INTEGER, min_advance_hours INTEGER
                );
                INSERT INTO consultation_settings VALUES (1, 30, 1, 1, 0);
                CREATE TABLE consultation_weekly_hours (
                    academy_id INTEGER, day_of_week INTEGER, is_available INTEGER, start_time TEXT, end_time TEXT
                );
                CREATE TABLE consultations (academy_id INTEGER, preferred_date TEXT, preferred_time TEXT, status TEXT);
            `);
            for (let day = 0; day < 7; day++) {
                database.prepare('INSERT INTO consultation_weekly_hours VALUES (1, ?, 1, ?, ?)')
                    .run(day, '09:00:00', '21:00:00');
            }
            jest.clearAllMocks();
        }
    };
}

module.exports = { createAcademyEventDatabase };
