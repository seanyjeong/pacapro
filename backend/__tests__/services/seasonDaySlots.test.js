jest.mock('../../config/database', () => ({ query: jest.fn(), execute: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { autoAssignStudentToSeasonSchedules } = require('../../services/seasonScheduleAssignment');

// 시즌 일정을 만드는 가짜 DB — 학생이 배정된 (날짜, 시간대)를 모은다
function scheduleDb() {
    const assigned = [];
    let current = null;
    const conn = { execute: jest.fn(async (sql, params) => {
        if (sql.includes('SELECT id FROM class_schedules')) { current = `${params[1]} ${params[2]}`; return [[{ id: 1 }]]; }
        if (sql.includes('SELECT id FROM attendance')) return [[]];
        if (sql.includes('INSERT INTO attendance')) { assigned.push(current); return [{ insertId: 1 }]; }
        throw new Error(`Unexpected query: ${sql}`);
    }) };
    return { conn, assigned };
}

// 배정 코드는 서버 시간대 자정을 UTC 날짜로 적는다(운영 서버는 UTC). 기대 날짜도 같은 식으로 만든다.
const MON = new Date('2026-11-23T00:00:00').toISOString().split('T')[0];
const TUE = new Date('2026-11-24T00:00:00').toISOString().split('T')[0];

// 2026-11-23(월) ~ 2026-11-24(화), 월·화 운영
const season = {
    season_start_date: '2026-11-23',
    season_end_date: '2026-11-24',
    operating_days: [1, 2],
    grade_time_slots: { '고3': ['afternoon', 'evening'], 'N수': ['morning', 'afternoon'] },
};

describe('시즌 요일별 운영 시간대', () => {
    test('요일별 시간대가 없으면 모든 운영 요일에 학년 시간대 그대로(지금과 같음)', async () => {
        const { conn, assigned } = scheduleDb();
        await autoAssignStudentToSeasonSchedules(7, 2, season, '고3', 'exam', null, null, conn);
        expect(assigned).toEqual([
            `${MON} afternoon`, `${MON} evening`,
            `${TUE} afternoon`, `${TUE} evening`,
        ]);
    });

    test('화요일을 오전·오후만 운영하면 고3 저녁 수업은 화요일에 안 생긴다', async () => {
        const { conn, assigned } = scheduleDb();
        const daySlots = { 1: ['morning', 'afternoon', 'evening'], 2: ['morning', 'afternoon'] };
        await autoAssignStudentToSeasonSchedules(7, 2, { ...season, operating_day_slots: JSON.stringify(daySlots) }, '고3', 'exam', null, null, conn);
        expect(assigned).toEqual([
            `${MON} afternoon`, `${MON} evening`,
            `${TUE} afternoon`,
        ]);
    });

    test('학생이 직접 고른 시간대에도 요일별 운영 시간대를 적용한다', async () => {
        const { conn, assigned } = scheduleDb();
        await autoAssignStudentToSeasonSchedules(7, 2, { ...season, operating_day_slots: { 2: ['morning'] } }, 'N수', 'exam', ['evening'], null, conn);
        expect(assigned).toEqual([`${MON} evening`]);
    });
});
