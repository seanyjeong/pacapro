describe('middleware/auth automation API key', () => {
    const originalEnv = { ...process.env };
    const originalWarn = console.warn;

    function loadAuth(env = {}) {
        jest.resetModules();
        jest.doMock('../../config/database', () => ({ query: jest.fn() }));
        jest.doMock('jsonwebtoken', () => ({
            verify: jest.fn(),
            sign: jest.fn(() => 'token'),
        }));
        process.env = { ...originalEnv, JWT_SECRET: 'test-secret', ...env };
        console.warn = jest.fn();
        return require('../../middleware/auth');
    }

    function mockResponse() {
        const res = {
            status: jest.fn(() => res),
            json: jest.fn(() => res),
        };
        return res;
    }

    afterEach(() => {
        process.env = { ...originalEnv };
        console.warn = originalWarn;
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('PACA_NOTIFICATION_API_KEY creates the internal automation account', async () => {
        const { checkPermission, verifyToken } = loadAuth({
            PACA_NOTIFICATION_API_KEY: 'paca-automation-key',
            N8N_API_KEY: 'legacy-key',
        });
        const req = {
            headers: { 'x-api-key': 'paca-automation-key' },
            query: { academy_id: 7 },
            body: {},
        };
        const res = mockResponse();
        const next = jest.fn();

        await verifyToken(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(req.user).toMatchObject({
            id: 0,
            email: 'paca-automation@system',
            name: 'PACA Automation',
            role: 'admin',
            academyId: 7,
            isServiceAccount: true,
            isNotificationAutomation: true,
        });
    });

    test('legacy N8N_API_KEY alone is not accepted as an automation key', async () => {
        const { verifyToken } = loadAuth({
            PACA_NOTIFICATION_API_KEY: '',
            N8N_API_KEY: 'legacy-key',
        });
        const req = {
            headers: { 'x-api-key': 'legacy-key' },
            query: {},
            body: {},
        };
        const res = mockResponse();
        const next = jest.fn();

        await verifyToken(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Unauthorized',
            message: 'No token provided',
        });
    });

    test('MAXLINK_READ_API_KEY is accepted only for an academy-scoped family GET', async () => {
        const { checkPermission, verifyToken } = loadAuth({
            MAXLINK_READ_API_KEY: 'maxlink-read-key-with-more-than-32-bytes',
            PACA_NOTIFICATION_API_KEY: 'paca-automation-key',
        });
        const req = {
            body: {},
            headers: { 'x-api-key': 'maxlink-read-key-with-more-than-32-bytes' },
            method: 'GET',
            originalUrl: '/paca/jungsi/family-scores/77?academy_id=2',
            query: { academy_id: '2' },
        };
        const res = mockResponse();
        const next = jest.fn();

        await verifyToken(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user).toMatchObject({
            academyId: 2,
            isServiceAccount: true,
            isSourceReadService: true,
            role: 'service_reader',
        });

        const permissionNext = jest.fn();
        checkPermission('payments', 'view')(req, res, permissionNext);
        expect(permissionNext).toHaveBeenCalledTimes(1);

        const editNext = jest.fn();
        checkPermission('payments', 'edit')(req, res, editNext);
        expect(editNext).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test.each([
        ['POST', '/paca/jungsi/family-scores/77?academy_id=2'],
        ['GET', '/paca/settings?academy_id=2'],
        ['GET', '/paca/students/77?academy_id=not-a-number'],
        ['GET', '/paca/payments?academy_id=2'],
        ['GET', '/paca/student-context?academy_id=2'],
    ])('MAXLINK_READ_API_KEY rejects %s %s', async (method, originalUrl) => {
        const { verifyToken } = loadAuth({
            MAXLINK_READ_API_KEY: 'maxlink-read-key-with-more-than-32-bytes',
            PACA_NOTIFICATION_API_KEY: 'paca-automation-key',
        });
        const academyId = new URL(originalUrl, 'https://paca.test').searchParams.get('academy_id');
        const req = {
            body: {},
            headers: { 'x-api-key': 'maxlink-read-key-with-more-than-32-bytes' },
            method,
            originalUrl,
            query: { academy_id: academyId },
        };
        const res = mockResponse();
        const next = jest.fn();

        await verifyToken(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
