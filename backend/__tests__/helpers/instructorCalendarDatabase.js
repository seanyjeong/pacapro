const { createAcademyEventDatabase } = require('./academyEventDatabase');

function createInstructorCalendarDatabase() {
    const db = createAcademyEventDatabase();
    const reset = db.reset;
    db.reset = () => {
        reset();
        db.exec(`
            CREATE TABLE instructors (
                id INTEGER PRIMARY KEY, academy_id INTEGER, name TEXT, status TEXT,
                deleted_at TEXT, salary_type TEXT, hourly_rate INTEGER
            );
            CREATE TABLE instructor_schedules (
                id INTEGER PRIMARY KEY, academy_id INTEGER, instructor_id INTEGER,
                work_date TEXT, time_slot TEXT, scheduled_start_time TEXT, scheduled_end_time TEXT
            );
            INSERT INTO instructors VALUES
                (1, 1, '김강사', 'active', NULL, 'hourly', 50000),
                (2, 1, '이강사', 'active', NULL, 'hourly', 60000),
                (3, 2, '다른 학원', 'active', NULL, 'hourly', 70000),
                (4, 1, '퇴사 강사', 'inactive', NULL, 'hourly', 50000),
                (5, 1, '삭제 강사', 'active', '2026-01-01', 'hourly', 50000);
            INSERT INTO instructor_schedules VALUES
                (1, 1, 1, '2026-09-01', 'morning', '09:00:00', '12:00:00'),
                (2, 1, 1, '2026-09-01', 'evening', '18:00:00', '21:00:00'),
                (3, 1, 2, '2026-09-30', 'afternoon', NULL, NULL),
                (4, 2, 3, '2026-09-01', 'morning', NULL, NULL),
                (5, 1, 1, '2026-08-31', 'morning', NULL, NULL),
                (6, 1, 1, '2026-10-01', 'morning', NULL, NULL),
                (7, 1, 4, '2026-09-05', 'afternoon', NULL, NULL),
                (8, 1, 5, '2026-09-05', 'afternoon', NULL, NULL),
                (9, 1, 3, '2026-09-05', 'afternoon', NULL, NULL);
        `);
    };
    return db;
}

module.exports = { createInstructorCalendarDatabase };
