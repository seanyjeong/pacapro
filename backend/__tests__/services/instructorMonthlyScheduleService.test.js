const {
    createInstructorMonthlyScheduleService,
} = require('../../services/instructorMonthlyScheduleService');

describe('instructorMonthlyScheduleService', () => {
    const repository = {
        findInstructor: jest.fn(),
        findMonthlySchedules: jest.fn(),
    };
    const service = createInstructorMonthlyScheduleService(repository);

    beforeEach(() => {
        repository.findInstructor.mockReset();
        repository.findMonthlySchedules.mockReset();
    });

    test('월별 출근 예정 일정을 날짜 문자열과 함께 반환한다', async () => {
        repository.findInstructor.mockResolvedValue({ id: 31 });
        repository.findMonthlySchedules.mockResolvedValue([
            {
                id: 701,
                work_date: new Date('2026-06-03T00:00:00.000Z'),
                time_slot: 'morning',
                scheduled_start_time: '09:00:00',
                scheduled_end_time: '12:00:00',
            },
        ]);

        const result = await service.getMonthlySchedule({ academyId: 1, instructorId: 31, year: 2026, month: 6 });

        expect(result).toEqual({
            instructor_id: 31,
            year_month: '2026-06',
            schedules: [{
                id: 701,
                work_date: '2026-06-03',
                time_slot: 'morning',
                scheduled_start_time: '09:00:00',
                scheduled_end_time: '12:00:00',
            }],
        });
    });

    test('잘못된 월은 validation 오류를 반환한다', async () => {
        await expect(service.getMonthlySchedule({ academyId: 1, instructorId: 31, year: 2026, month: 13 }))
            .rejects.toMatchObject({ code: 'INVALID_PERIOD' });
    });

    test('다른 학원의 강사는 찾을 수 없음 오류를 반환한다', async () => {
        repository.findInstructor.mockResolvedValue(null);

        await expect(service.getMonthlySchedule({ academyId: 1, instructorId: 999, year: 2026, month: 6 }))
            .rejects.toMatchObject({ code: 'INSTRUCTOR_NOT_FOUND' });
    });
});
