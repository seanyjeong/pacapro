const repository = require('../repositories/instructorCalendarRepository');
const { decrypt } = require('../utils/encryption');
const { MIN_CALENDAR_YEAR, MAX_CALENDAR_YEAR, MONTHS_PER_YEAR } = require('../constants/instructorCalendar');

function getCalendarPeriod(year, month) {
    if (!/^\d{4}$/.test(String(year)) || !/^\d{1,2}$/.test(String(month)) ||
        Number(year) < MIN_CALENDAR_YEAR || Number(year) > MAX_CALENDAR_YEAR ||
        Number(month) < 1 || Number(month) > MONTHS_PER_YEAR) {
        return null;
    }
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const nextMonth = Number(month) === MONTHS_PER_YEAR
        ? `${Number(year) + 1}-01` : `${year}-${String(Number(month) + 1).padStart(2, '0')}`;
    return { yearMonth, startDate: `${yearMonth}-01`, endDate: `${nextMonth}-01` };
}

async function getInstructorCalendar(academyId, query) {
    const period = getCalendarPeriod(query.year, query.month);
    if (!period) return { status: 400, message: '조회할 연도와 월을 확인해주세요.' };

    const [instructors, rows] = await Promise.all([
        repository.findInstructors(academyId),
        repository.findSchedules(academyId, period.startDate, period.endDate),
    ]);
    const roster = new Map(instructors.map(instructor => [instructor.id, {
        id: instructor.id, name: decrypt(instructor.name),
    }]));
    const schedules = rows.map(row => {
        const name = decrypt(row.instructor_name);
        roster.set(row.instructor_id, { id: row.instructor_id, name });
        return {
            id: row.id,
            instructor_id: row.instructor_id,
            instructor_name: name,
            work_date: typeof row.work_date === 'string'
                ? row.work_date.split('T')[0] : row.work_date.toISOString().split('T')[0],
            time_slot: row.time_slot,
            scheduled_start_time: row.scheduled_start_time,
            scheduled_end_time: row.scheduled_end_time,
        };
    });
    return {
        status: 200,
        data: {
            year_month: period.yearMonth,
            instructors: [...roster.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
            schedules,
        },
    };
}

module.exports = { getCalendarPeriod, getInstructorCalendar };
