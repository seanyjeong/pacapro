jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('node-cron', () => ({
    schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

const cron = require('node-cron');
const logger = require('../../utils/logger');
const {
    NOTIFICATION_JOBS,
    buildJobUrl,
    getSchedulerConfig,
    initNotificationScheduler,
    runNotificationJobsOnce,
    stopNotificationScheduler,
    triggerNotificationJob,
} = require('../../scheduler/notificationScheduler');

describe('notificationScheduler', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        jest.clearAllMocks();
        stopNotificationScheduler();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('자동 발송 job 6개를 정의한다', () => {
        expect(NOTIFICATION_JOBS.map(job => job.path)).toEqual([
            '/paca/notifications/send-unpaid-today-auto',
            '/paca/notifications/send-trial-today-auto',
            '/paca/notifications/send-unpaid-today-auto-sens',
            '/paca/notifications/send-trial-today-auto-sens',
            '/paca/notifications/send-reminder-auto',
            '/paca/notifications/send-reminder-auto-sens',
        ]);
    });

    test('config는 PACA_NOTIFICATION_API_KEY만 자동 발송 키로 사용한다', () => {
        process.env.PACA_INTERNAL_NOTIFICATION_SCHEDULER = 'true';
        process.env.PACA_NOTIFICATION_API_KEY = 'paca-key';
        process.env.N8N_API_KEY = 'legacy-key';

        expect(getSchedulerConfig()).toMatchObject({
            enabled: true,
            cronExpression: '5 * * * *',
            timezone: 'Asia/Seoul',
            apiKey: 'paca-key',
        });
    });

    test('legacy N8N_API_KEY는 자동 발송 키로 사용하지 않는다', () => {
        process.env.PACA_INTERNAL_NOTIFICATION_SCHEDULER = 'true';
        delete process.env.PACA_NOTIFICATION_API_KEY;
        process.env.N8N_API_KEY = 'legacy-key';

        expect(getSchedulerConfig().apiKey).toBe('');
    });

    test('buildJobUrl은 base trailing slash를 정리한다', () => {
        expect(buildJobUrl('http://127.0.0.1:8320/', '/paca/notifications/send-reminder-auto'))
            .toBe('http://127.0.0.1:8320/paca/notifications/send-reminder-auto');
    });

    test('triggerNotificationJob은 X-API-Key로 endpoint를 호출한다', async () => {
        const fetchImpl = jest.fn(async () => ({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ message: 'ok' }),
        }));

        const result = await triggerNotificationJob(
            { name: 'job-a', path: '/paca/notifications/send-a' },
            { fetchImpl, baseUrl: 'http://127.0.0.1:8320', apiKey: 'scheduler-key', logger }
        );

        expect(result).toEqual({
            name: 'job-a',
            status: 200,
            ok: true,
            body: { message: 'ok' },
        });
        expect(fetchImpl).toHaveBeenCalledWith(
            'http://127.0.0.1:8320/paca/notifications/send-a',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'x-api-key': 'scheduler-key' }),
                body: '{}',
            })
        );
    });

    test('api key가 없으면 발송 호출을 skip한다', async () => {
        const fetchImpl = jest.fn();
        const result = await triggerNotificationJob(
            { name: 'job-a', path: '/paca/notifications/send-a' },
            { fetchImpl, baseUrl: 'http://127.0.0.1:8320', apiKey: '', logger }
        );

        expect(result).toEqual({ name: 'job-a', skipped: true, reason: 'missing_api_key' });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    test('runNotificationJobsOnce는 모든 job을 순차 실행한다', async () => {
        const fetchImpl = jest.fn(async () => ({
            ok: true,
            status: 200,
            text: async () => '{}',
        }));

        const results = await runNotificationJobsOnce({
            jobs: [
                { name: 'a', path: '/a' },
                { name: 'b', path: '/b' },
            ],
            fetchImpl,
            baseUrl: 'http://127.0.0.1:8320',
            apiKey: 'key',
            logger,
        });

        expect(results).toHaveLength(2);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    test('initNotificationScheduler는 비활성화 상태에서 cron을 등록하지 않는다', () => {
        process.env.PACA_INTERNAL_NOTIFICATION_SCHEDULER = 'false';

        const task = initNotificationScheduler({ logger });

        expect(task).toBeNull();
        expect(cron.schedule).not.toHaveBeenCalled();
    });

    test('initNotificationScheduler는 활성화와 api key가 있을 때 cron을 등록한다', () => {
        process.env.PACA_INTERNAL_NOTIFICATION_SCHEDULER = 'true';
        process.env.PACA_NOTIFICATION_API_KEY = 'key';

        const task = initNotificationScheduler({ logger });

        expect(task).toBeTruthy();
        expect(cron.schedule).toHaveBeenCalledWith(
            '5 * * * *',
            expect.any(Function),
            { timezone: 'Asia/Seoul' }
        );
    });
});
