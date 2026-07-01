jest.mock('../../../../routes/notifications/_utils', () => ({
    db: {},
    pool: {},
    verifyToken: jest.fn((req, res, next) => {
        req.user = { id: 1, academyId: 7 };
        next();
    }),
    checkPermission: jest.fn(),
    decryptApiKey: jest.fn(),
    sendAlimtalk: jest.fn(),
    sendAlimtalkSolapi: jest.fn(),
    createUnpaidNotificationMessage: jest.fn(),
    isValidPhoneNumber: jest.fn(),
    decrypt: jest.fn(),
    decryptStudentInfo: jest.fn(),
    decryptStudentArray: jest.fn(),
    ENCRYPTION_KEY: 'test-key',
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const sendUtils = require('../../../../routes/notifications/send/_utils');
const parentUtils = require('../../../../routes/notifications/_utils');

describe('notifications/send/_utils automation auth', () => {
    const originalPacaKey = process.env.PACA_NOTIFICATION_API_KEY;
    const originalN8nKey = process.env.N8N_API_KEY;

    afterEach(() => {
        if (originalPacaKey === undefined) delete process.env.PACA_NOTIFICATION_API_KEY;
        else process.env.PACA_NOTIFICATION_API_KEY = originalPacaKey;
        if (originalN8nKey === undefined) delete process.env.N8N_API_KEY;
        else process.env.N8N_API_KEY = originalN8nKey;
        jest.clearAllMocks();
    });

    test('PACA_NOTIFICATION_API_KEY만 자동화 키로 사용한다', () => {
        process.env.PACA_NOTIFICATION_API_KEY = 'paca-key';
        process.env.N8N_API_KEY = 'legacy-key';

        expect(sendUtils.getNotificationAutomationApiKey()).toBe('paca-key');
    });

    test('legacy N8N_API_KEY fallback을 허용하지 않는다', () => {
        delete process.env.PACA_NOTIFICATION_API_KEY;
        process.env.N8N_API_KEY = 'legacy-key';

        expect(sendUtils.getNotificationAutomationApiKey()).toBe('');
    });

    test('자동화 키 env가 없으면 placeholder X-API-Key를 허용하지 않는다', () => {
        delete process.env.PACA_NOTIFICATION_API_KEY;
        delete process.env.N8N_API_KEY;
        const req = { headers: { 'x-api-key': 'replace-with-local-automation-api-key' } };

        expect(sendUtils.getNotificationAutomationApiKey()).toBe('');
        expect(sendUtils.hasValidNotificationAutomationKey(req)).toBe(false);
    });

    test('유효한 X-API-Key 요청은 verifyToken 없이 scheduler 사용자로 통과한다', () => {
        process.env.PACA_NOTIFICATION_API_KEY = 'scheduler-key';
        const req = { headers: { 'x-api-key': 'scheduler-key' } };
        const res = {};
        const next = jest.fn();

        sendUtils.verifyNotificationAutomation(req, res, next);

        expect(parentUtils.verifyToken).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user).toMatchObject({ role: 'scheduler', isNotificationScheduler: true });
    });

    test('X-API-Key가 없으면 기존 verifyToken으로 fallback한다', () => {
        process.env.PACA_NOTIFICATION_API_KEY = 'scheduler-key';
        const req = { headers: {} };
        const res = {};
        const next = jest.fn();

        sendUtils.verifyNotificationAutomation(req, res, next);

        expect(parentUtils.verifyToken).toHaveBeenCalledWith(req, res, next);
    });
});
