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
        const { verifyToken } = loadAuth({
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
});
