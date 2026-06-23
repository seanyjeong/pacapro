const {
    buildAllowedOrigins,
    createCorsOptions,
    parseOriginList,
} = require('../../config/cors');

function checkOrigin(options, origin) {
    return new Promise((resolve, reject) => {
        options.origin(origin, (error, allowed) => {
            if (error) reject(error);
            else resolve(allowed);
        });
    });
}

describe('cors config', () => {
    test('keeps existing production origins and allows local 3109 preview', async () => {
        const options = createCorsOptions({ env: { NODE_ENV: 'production' } });

        await expect(checkOrigin(options, 'https://pacapro.vercel.app')).resolves.toBe(true);
        await expect(checkOrigin(options, 'https://chejump.com')).resolves.toBe(true);
        await expect(checkOrigin(options, 'http://localhost:3000')).resolves.toBe(true);
        await expect(checkOrigin(options, 'http://localhost:3109')).resolves.toBe(true);
    });

    test('allows server-to-server requests without an origin', async () => {
        const options = createCorsOptions({ env: { NODE_ENV: 'production' } });

        await expect(checkOrigin(options)).resolves.toBe(true);
    });

    test('blocks unknown production origins without throwing', async () => {
        const logger = { warn: jest.fn() };
        const options = createCorsOptions({ env: { NODE_ENV: 'production' }, logger });

        await expect(checkOrigin(options, 'https://unknown.example.com')).resolves.toBe(false);
        expect(logger.warn).toHaveBeenCalledWith('[CORS] 차단된 origin: https://unknown.example.com');
    });

    test('supports comma-separated extra origins from env', () => {
        const origins = buildAllowedOrigins({
            CORS_ORIGIN: 'https://single.example.com',
            CORS_ORIGINS: 'https://a.example.com, https://b.example.com',
        });

        expect(origins).toEqual(expect.arrayContaining([
            'https://single.example.com',
            'https://a.example.com',
            'https://b.example.com',
            'http://localhost:3109',
        ]));
    });

    test('trims empty origin list entries', () => {
        expect(parseOriginList(' https://a.example.com, ,https://b.example.com ')).toEqual([
            'https://a.example.com',
            'https://b.example.com',
        ]);
    });
});
