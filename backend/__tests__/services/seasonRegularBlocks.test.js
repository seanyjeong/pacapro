jest.mock('../../config/database', () => ({ query: jest.fn(), execute: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock('../../utils/encryption', () => ({ decrypt: jest.fn(v => v) }));
jest.mock('../../services/seasonScheduleAssignment', () => {
    const actual = jest.requireActual('../../services/seasonScheduleAssignment');
    return {
        ...actual,
        autoAssignStudentToSeasonSchedules: jest.fn(),
        removeStudentFromRegularSchedules: jest.fn(),
    };
});

const pool = require('../../config/database');
const schedules = require('../../services/seasonScheduleAssignment');
const { seasonRegularBlockStart, findSeasonRegularBlocks } = schedules;
const { assignStudentToMonth, runMonthlyAssignment } = require('../../cron/monthly-schedule-assign');
const { autoAssignAllSeasonStudentsToSchedules } = require('../../routes/seasons/_utils');

// 2026-11 월요일(1)·수요일(3) 정규 수업을 배정하는 가짜 DB — 배정된 날짜를 모은다
function monthDb() {
    const assigned = [];
    let scheduleDate = null;
    const conn = { query: jest.fn(async (sql, params) => {
        if (sql.includes('SELECT id FROM class_schedules')) { scheduleDate = params[1]; return [[{ id: 1 }]]; }
        if (sql.includes('SELECT id FROM attendance')) return [[]];
        if (sql.includes('INSERT INTO attendance')) { assigned.push([params[1], scheduleDate]); return [{ insertId: 1 }]; }
        throw new Error(`Unexpected query: ${sql}`);
    }) };
    return { conn, assigned };
}

describe('시즌 등록생 정규 수업 막힘 기간', () => {
    test('비시즌 종강일 다음 날부터 막히고, 종강일이 없는 옛 시즌은 시즌 시작일부터', () => {
        expect(seasonRegularBlockStart({ non_season_end_date: '2026-10-31', season_start_date: '2026-11-23' })).toBe('2026-11-01');
        expect(seasonRegularBlockStart({ non_season_end_date: '2026-12-31', season_start_date: '2027-01-05' })).toBe('2027-01-01');
        expect(seasonRegularBlockStart({ non_season_end_date: null, season_start_date: '2026-11-23' })).toBe('2026-11-23');
    });

    test('끝나지 않은 시즌의 취소 안 된 등록만 학생별 기간으로 돌려준다', async () => {
        const conn = { execute: jest.fn().mockResolvedValue([[
            { student_id: 7, non_season_end_date: '2026-10-31', season_start_date: '2026-11-23', season_end_date: '2027-01-29' },
        ]]) };
        await expect(findSeasonRegularBlocks(conn, 2, '2026-11-01')).resolves.toEqual([
            { studentId: 7, from: '2026-11-01', to: '2027-01-29' },
        ]);
        const [sql, params] = conn.execute.mock.calls[0];
        expect(sql).toContain("se.status != 'ended'");
        expect(sql).toContain('ss.is_cancelled = 0');
        expect(sql).not.toContain('ss.student_id = ?');
        expect(params).toEqual([2, '2026-11-01']);

        await findSeasonRegularBlocks(conn, 2, '2026-11-04', 7);
        expect(conn.execute.mock.calls[1][0]).toContain('ss.student_id = ?');
        expect(conn.execute.mock.calls[1][1]).toEqual([2, '2026-11-04', 7]);
    });
});

describe('매월 1일 정규 수업 자동 배정', () => {
    test('막힘 기간 날짜는 건너뛰고 그 전 날짜만 배정한다', async () => {
        const { conn, assigned } = monthDb();
        const result = await assignStudentToMonth(conn, 7, 2, [1, 3], 2026, 11, 'evening', null,
            [{ from: '2026-11-12', to: '2027-01-29' }]);
        expect(assigned.map(([, date]) => date)).toEqual(['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11']);
        expect(result.assigned).toBe(4);
    });

    test('시즌 등록생은 그 달 정규 수업을 받지 않고, 다른 학생은 그대로 받는다', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-11-01T00:05:00Z'));
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const { conn, assigned } = monthDb();
        pool.query.mockImplementation(async (sql, params) => {
            if (sql.includes('UPDATE students')) return [{ affectedRows: 0 }];
            if (sql.includes('SELECT DISTINCT academy_id')) return [[{ academy_id: 2 }]];
            if (sql.includes('FROM students')) return [[
                { id: 7, name: '시즌', class_days: '[1,3]', time_slot: 'evening', enrollment_date: null },
                { id: 8, name: '정규', class_days: '[1]', time_slot: 'evening', enrollment_date: null },
            ]];
            return conn.query(sql, params);
        });
        pool.execute.mockResolvedValue([[
            { student_id: 7, non_season_end_date: '2026-10-31', season_start_date: '2026-11-23', season_end_date: '2027-01-29' },
        ]]);
        try {
            await runMonthlyAssignment();
            expect(pool.execute).toHaveBeenCalledWith(expect.stringContaining('FROM student_seasons'), [2, '2026-11-01']);
            expect(assigned.filter(([studentId]) => studentId === 7)).toEqual([]);
            expect(assigned.filter(([studentId]) => studentId === 8).map(([, date]) => date))
                .toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
        } finally {
            jest.useRealTimers();
            console.log.mockRestore();
        }
    });
});

describe('시즌 시작(활성화)', () => {
    test('정규 출결을 비시즌 종강 다음 날부터 빼고 등록 때 고른 시간대로 시즌 출결을 넣는다', async () => {
        const season = { id: 21, non_season_end_date: '2026-10-31', season_start_date: '2026-11-23', season_end_date: '2027-01-29' };
        pool.execute.mockReset()
            .mockResolvedValueOnce([[season]])
            .mockResolvedValueOnce([[
                { student_id: 7, grade: '고3', student_type: 'exam', time_slots: '["afternoon","evening","morning"]' },
                { student_id: 8, grade: 'N수', student_type: 'exam', time_slots: null },
            ]]);
        schedules.removeStudentFromRegularSchedules.mockResolvedValue({ removed: 3 });
        schedules.autoAssignStudentToSeasonSchedules.mockResolvedValue({ assigned: 10, created: 0 });

        const result = await autoAssignAllSeasonStudentsToSchedules(21, 2);

        expect(schedules.removeStudentFromRegularSchedules.mock.calls).toEqual([
            [7, 2, '2026-11-01', '2027-01-29'],
            [8, 2, '2026-11-01', '2027-01-29'],
        ]);
        expect(schedules.autoAssignStudentToSeasonSchedules.mock.calls).toEqual([
            [7, 2, season, '고3', 'exam', ['afternoon', 'evening', 'morning']],
            [8, 2, season, 'N수', 'exam', null],
        ]);
        expect(schedules.removeStudentFromRegularSchedules.mock.invocationCallOrder[0])
            .toBeLessThan(schedules.autoAssignStudentToSeasonSchedules.mock.invocationCallOrder[0]);
        expect(result).toEqual({ totalAssigned: 20, totalCreated: 0, studentsProcessed: 2 });
    });
});
