jest.mock('../../repositories/trialStatusRepository', () => ({
    findAttendanceContextForUpdate: jest.fn(),
    findTrialStudents: jest.fn(),
    updateTrialState: jest.fn(),
}));

const repository = require('../../repositories/trialStatusRepository');
const {
    TrialStatusValidationError,
    applyTrialAttendanceChange,
    expireTrialStudents,
    prepareTrialActivation,
    prepareStudentTrialUpdate,
    resolveTrialState,
} = require('../../services/trialStatusService');

const TODAY = '2026-08-26';

describe('trialStatusService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('지난 미출석 일정만 남으면 미등록 상태와 남은 횟수 0을 계산한다', () => {
        expect(resolveTrialState(
            [{ date: '2026-08-24', time_slot: 'evening', attended: false }],
            { today: TODAY }
        )).toMatchObject({
            status: 'pending',
            isTrial: false,
            trialRemaining: 0,
            lastTrialDate: '2026-08-24',
        });
    });

    test('과거 이력과 오늘 이후 미출석 일정이 섞이면 앞으로 남은 일정만 센다', () => {
        expect(resolveTrialState([
            { date: '2026-08-20', time_slot: 'evening', attended: true },
            { date: '2026-08-24', time_slot: 'evening', attended: false },
            { date: '2026-08-27', time_slot: 'evening', attended: false },
        ], { today: TODAY })).toMatchObject({
            status: 'trial',
            isTrial: true,
            trialRemaining: 1,
            lastTrialDate: '2026-08-27',
        });
    });

    test('체험 활성화는 오늘 또는 이후의 새 미출석 일정이 반드시 필요하다', () => {
        expect(() => prepareTrialActivation([], { today: TODAY }))
            .toThrow(TrialStatusValidationError);
        expect(() => prepareTrialActivation(
            [{ date: '2026-08-24', time_slot: 'evening', attended: false }],
            { today: TODAY }
        )).toThrow('오늘 또는 이후의 새 체험 일정을 1개 이상 선택해주세요.');
    });

    test('체험 활성화 시 클라이언트 값 대신 일정에서 남은 횟수를 계산한다', () => {
        expect(prepareTrialActivation([
            { date: '2026-08-20', time_slot: 'evening', attended: true },
            { date: '2026-08-27', time_slot: 'evening', attended: false },
            { date: '2026-08-28', time_slot: 'afternoon', attended: false },
        ], { today: TODAY })).toMatchObject({
            status: 'trial',
            isTrial: true,
            trialRemaining: 2,
            scheduleDates: [
                { date: '2026-08-27', time_slot: 'evening', attended: false },
                { date: '2026-08-28', time_slot: 'afternoon', attended: false },
            ],
        });
    });

    test('status만 trial이거나 숫자형 is_trial이어도 새 일정 검증을 우회할 수 없다', () => {
        const currentStudent = { status: 'pending', is_trial: 0, trial_dates: null };

        expect(() => prepareStudentTrialUpdate({
            currentStudent,
            status: 'trial',
            today: TODAY,
        })).toThrow('오늘 또는 이후의 새 체험 일정을 1개 이상 선택해주세요.');
        expect(() => prepareStudentTrialUpdate({
            currentStudent,
            isTrial: 1,
            trialDates: [{ date: '2026-08-20', time_slot: 'evening' }],
            today: TODAY,
        })).toThrow('오늘 또는 이후의 새 체험 일정을 1개 이상 선택해주세요.');
    });

    test('체험생을 비체험 상태로 바꾸면 상태와 남은 횟수도 함께 정리한다', () => {
        expect(prepareStudentTrialUpdate({
            currentStudent: {
                status: 'trial',
                is_trial: 1,
                trial_remaining: 2,
                trial_dates: [{ date: '2026-08-27', time_slot: 'evening' }],
            },
            isTrial: false,
            today: TODAY,
        })).toMatchObject({
            status: 'pending',
            isTrial: false,
            trialRemaining: 0,
        });
    });

    test('마지막 체험 출석 처리 즉시 미등록으로 전환한다', async () => {
        const context = {
            previousAttendanceStatus: null,
            student: {
                id: 10,
                academy_id: 2,
                status: 'trial',
                is_trial: 1,
                trial_remaining: 1,
                trial_dates: [{ date: TODAY, time_slot: 'evening', attended: false }],
            },
        };

        const result = await applyTrialAttendanceChange({
            connection: {},
            context,
            schedule: { class_date: TODAY, time_slot: 'evening' },
            attendanceStatus: 'present',
            today: TODAY,
        });

        expect(result).toMatchObject({ status: 'pending', isTrial: false, trialRemaining: 0 });
        expect(repository.updateTrialState).toHaveBeenCalledWith({}, expect.objectContaining({
            academyId: 2,
            studentId: 10,
            status: 'pending',
            isTrial: false,
            trialRemaining: 0,
        }));
    });

    test('지난 마지막 출석을 취소해도 만료 학생을 체험 상태로 되살리지 않는다', async () => {
        const context = {
            previousAttendanceStatus: 'present',
            student: {
                id: 11,
                academy_id: 2,
                status: 'pending',
                is_trial: 0,
                trial_remaining: 0,
                trial_dates: [{ date: '2026-08-24', time_slot: 'evening', attended: true }],
            },
        };

        const result = await applyTrialAttendanceChange({
            connection: {},
            context,
            schedule: { class_date: '2026-08-24', time_slot: 'evening' },
            attendanceStatus: 'none',
            today: TODAY,
        });

        expect(result).toMatchObject({ status: 'pending', isTrial: false, trialRemaining: 0 });
        expect(repository.updateTrialState).toHaveBeenCalledWith({}, expect.objectContaining({
            status: 'pending',
            isTrial: false,
            trialRemaining: 0,
        }));
    });

    test('자정 안전망은 만료 학생만 미등록으로 재계산한다', async () => {
        repository.findTrialStudents.mockResolvedValue([
            {
                id: 20,
                academy_id: 2,
                trial_dates: [{ date: '2026-08-24', time_slot: 'evening', attended: false }],
            },
            {
                id: 21,
                academy_id: 2,
                trial_dates: [{ date: '2026-08-27', time_slot: 'evening', attended: false }],
            },
        ]);

        const result = await expireTrialStudents({ connection: {}, today: TODAY });

        expect(result).toEqual({ checked: 2, expired: 1, expiredStudents: [20] });
        expect(repository.updateTrialState).toHaveBeenCalledTimes(1);
        expect(repository.updateTrialState).toHaveBeenCalledWith({}, expect.objectContaining({
            studentId: 20,
            status: 'pending',
            isTrial: false,
            trialRemaining: 0,
        }));
    });
});
