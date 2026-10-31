jest.mock('../../config/database', () => ({}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const { autoAssignStudentToSchedules } = require('../../routes/students/_utils');

function fakeConnection(dates, seasonGaps = []) {
    let existingAttendance = true;
    return { query: jest.fn(async (sql, params) => {
        if (sql.includes('FROM student_seasons')) return [seasonGaps];
        if (sql.includes('SELECT id FROM class_schedules')) {
            dates.push(params);
            return [[{ id: 123 }]];
        }
        if (sql.includes('SELECT id FROM attendance')) {
            if (existingAttendance) { existingAttendance = false; return [[{ id: 55 }]]; }
            return [[]];
        }
        if (sql.includes('INSERT INTO attendance')) return [{ insertId: 33 }];
        throw new Error('Unexpected write');
    }) };
}

test('미래 복귀월도 복귀일~말일만 배정하고 기존 출결과 요일별 시간대를 보존한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-01T12:00:00Z'));
    const dates = [];
    const connection = fakeConnection(dates);
    try {
        const result = await autoAssignStudentToSchedules(connection, 3, 2,
            [{ day: 1, timeSlot: 'morning' }, { day: 5, timeSlot: 'afternoon' }],
            '2026-10-21', 'evening', { includeFutureMonth: true });
        expect(dates).toEqual([
            [2, '2026-10-23', 'afternoon'], [2, '2026-10-26', 'morning'], [2, '2026-10-30', 'afternoon'],
        ]);
        expect(result).toEqual({ assigned: 2, created: 0 });
        connection.query.mockClear();
        await autoAssignStudentToSchedules(connection, 3, 2, [1, 5], '2026-10-21');
        expect(connection.query).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
});

test('시즌 등록생은 비시즌 종강 다음 날~시즌 시작 전날 정규 수업을 배정하지 않는다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T12:00:00Z'));
    const dates = [];
    const connection = fakeConnection(dates, [{ non_season_end: '2026-10-24', season_start: '2026-10-30' }]);
    try {
        await autoAssignStudentToSchedules(connection, 3, 2,
            [{ day: 1, timeSlot: 'morning' }, { day: 5, timeSlot: 'afternoon' }], '2026-10-21', 'evening');
        expect(dates).toEqual([[2, '2026-10-23', 'afternoon'], [2, '2026-10-30', 'afternoon']]);
    } finally { jest.useRealTimers(); }
});
