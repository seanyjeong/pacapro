const { getMaxlinkWebhookConfig } = require('../../config/maxlinkWebhook');

const VALID_ENV = {
    MAXLINK_WEBHOOK_SECRET: 'paca-webhook-test-secret-with-more-than-32-bytes',
    MAXLINK_WEBHOOK_URL: 'https://api.maxlink.supermax.kr/v1/source-events/paca'
};

describe('MAX LINK webhook config', () => {
    test('accepts an HTTPS endpoint and a strong secret', () => {
        expect(getMaxlinkWebhookConfig(VALID_ENV)).toEqual({
            secret: VALID_ENV.MAXLINK_WEBHOOK_SECRET,
            timeoutMs: 5000,
            url: VALID_ENV.MAXLINK_WEBHOOK_URL
        });
    });

    test('rejects a secret shorter than 32 bytes', () => {
        expect(() => getMaxlinkWebhookConfig({
            ...VALID_ENV,
            MAXLINK_WEBHOOK_SECRET: 'too-short'
        })).toThrow('MAXLINK_WEBHOOK_SECRET');
    });

    test('rejects a non-HTTPS production endpoint', () => {
        expect(() => getMaxlinkWebhookConfig({
            ...VALID_ENV,
            MAXLINK_WEBHOOK_URL: 'http://api.maxlink.supermax.kr/v1/source-events/paca'
        })).toThrow('HTTPS');
    });
});
