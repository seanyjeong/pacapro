jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../../services/seasonGraduationService', () => ({
    graduateDueSeasonStudents: jest.fn().mockResolvedValue(0),
}));

const cron = require('node-cron');
const { graduateDueSeasonStudents } = require('../../services/seasonGraduationService');
const { initSeasonLifecycleScheduler } = require('../../scheduler/seasonLifecycleScheduler');

test('매일 00:00 KST에 졸업을 예약하고 재시작 시 누락분을 처리한다', async () => {
    initSeasonLifecycleScheduler();
    expect(cron.schedule).toHaveBeenCalledWith('0 0 * * *', expect.any(Function), { timezone: 'Asia/Seoul' });
    await Promise.resolve();
    expect(graduateDueSeasonStudents).toHaveBeenCalledTimes(1);
    cron.schedule.mock.calls[0][1]();
    await Promise.resolve();
    expect(graduateDueSeasonStudents).toHaveBeenCalledTimes(2);
});
