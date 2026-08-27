class InstructorMonthlyScheduleError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function createInstructorMonthlyScheduleService(repository) {
    async function getMonthlySchedule({ academyId, instructorId, year, month }) {
        const normalizedYear = Number(year);
        const normalizedMonth = Number(month);
        const normalizedInstructorId = Number(instructorId);

        if (!Number.isInteger(normalizedYear) || normalizedYear < 2000 || normalizedYear > 2100 ||
            !Number.isInteger(normalizedMonth) || normalizedMonth < 1 || normalizedMonth > 12 ||
            !Number.isInteger(normalizedInstructorId) || normalizedInstructorId < 1) {
            throw new InstructorMonthlyScheduleError('INVALID_PERIOD', '조회할 연도와 월을 확인해주세요.');
        }

        const instructor = await repository.findInstructor(academyId, normalizedInstructorId);
        if (!instructor) {
            throw new InstructorMonthlyScheduleError('INSTRUCTOR_NOT_FOUND', '강사를 찾을 수 없습니다.');
        }

        const yearMonth = `${normalizedYear}-${String(normalizedMonth).padStart(2, '0')}`;
        const schedules = await repository.findMonthlySchedules(academyId, normalizedInstructorId, yearMonth);

        return {
            instructor_id: normalizedInstructorId,
            year_month: yearMonth,
            schedules: schedules.map((schedule) => ({
                ...schedule,
                work_date: normalizeDate(schedule.work_date),
            })),
        };
    }

    return { getMonthlySchedule };
}

function normalizeDate(value) {
    if (typeof value === 'string') return value.split('T')[0];
    return value.toISOString().split('T')[0];
}

function getInstructorMonthlySchedule(input) {
    const repository = require('../repositories/instructorMonthlyScheduleRepository');
    return createInstructorMonthlyScheduleService(repository).getMonthlySchedule(input);
}

module.exports = {
    InstructorMonthlyScheduleError,
    createInstructorMonthlyScheduleService,
    getInstructorMonthlySchedule,
};
