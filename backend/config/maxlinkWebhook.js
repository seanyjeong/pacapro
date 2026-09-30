const DEFAULT_TIMEOUT_MS = 5000;
const MIN_SECRET_BYTES = 32;

function getMaxlinkWebhookConfig(env = process.env) {
    const url = env.MAXLINK_WEBHOOK_URL;
    const secret = env.MAXLINK_WEBHOOK_SECRET;
    if (!url) {
        throw new Error('MAXLINK_WEBHOOK_URL is required');
    }
    if (!secret || Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES) {
        throw new Error('MAXLINK_WEBHOOK_SECRET must contain at least 32 bytes');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch (error) {
        throw new Error('MAXLINK_WEBHOOK_URL must be a valid URL', { cause: error });
    }
    if (parsedUrl.protocol !== 'https:') {
        throw new Error('MAXLINK_WEBHOOK_URL must use HTTPS');
    }

    return {
        url: parsedUrl.toString(),
        secret,
        timeoutMs: DEFAULT_TIMEOUT_MS
    };
}

module.exports = {
    DEFAULT_TIMEOUT_MS,
    MIN_SECRET_BYTES,
    getMaxlinkWebhookConfig
};
