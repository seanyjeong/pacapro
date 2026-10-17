jest.mock('../../config/database', () => ({}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const { autoAssignStudentToSchedules } = require('../../routes/students/_utils');

test('미래 복귀월도 복귀일~말일만 배정하고 기존 출결과 요일별 시간대를 보존한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-01T12:00:00Z'));
    const dates = [];
    let existingAttendance = true;
    const connection = { query: jest.fn(async (sql, params) => {
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
