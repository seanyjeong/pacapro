describe('utils/env-validator notification automation env', () => {
    const originalEnv = { ...process.env };
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
    };

    function loadValidator(env = {}) {
        jest.resetModules();
        process.env = { ...env };
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();
        return require('../../utils/env-validator');
    }

    afterEach(() => {
        process.env = { ...originalEnv };
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('production requires PACA notification and MAX LINK read keys', () => {
        const { validateEnv } = loadValidator({
            NODE_ENV: 'production',
            DB_PASSWORD: 'db-password',
            DATA_ENCRYPTION_KEY: 'encryption-key-32-byte-value-here',
            JWT_SECRET: 'jwt-secret',
        });

        expect(validateEnv()).toBe(false);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('PACA_NOTIFICATION_API_KEY'));
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('MAXLINK_READ_API_KEY'));
    });

    test('production rejects a short MAX LINK read key', () => {
        const { validateEnv } = loadValidator({
            NODE_ENV: 'production',
            DB_PASSWORD: 'db-password',
            DATA_ENCRYPTION_KEY: 'encryption-key-32-byte-value-here',
            JWT_SECRET: 'jwt-secret',
            MAXLINK_READ_API_KEY: 'short',
            PACA_NOTIFICATION_API_KEY: 'paca-notification-key',
        });

        expect(validateEnv()).toBe(false);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('MAXLINK_READ_API_KEY'));
    });

    test('development defaults set dedicated PACA service keys only', () => {
        const { validateEnv } = loadValidator({ NODE_ENV: 'development' });

        expect(validateEnv()).toBe(true);
        expect(process.env.PACA_NOTIFICATION_API_KEY).toBe('replace-with-local-paca-notification-api-key');
        expect(process.env.MAXLINK_READ_API_KEY).toBe('replace-with-local-maxlink-read-api-key');
        expect(process.env.N8N_API_KEY).toBeUndefined();
    });
});
