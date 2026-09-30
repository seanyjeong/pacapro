const crypto = require('crypto');
const axios = require('axios');

function buildWebhookPayload(event) {
    return {
        academyId: Number(event.academy_id),
        eventId: event.event_id,
        occurredAt: normalizeOccurredAt(event.occurred_at),
        sourceStudentId: String(event.source_student_id),
        status: event.status
    };
}

function signWebhookBody(body, timestamp, secret) {
    const digest = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
    return `sha256=${digest}`;
}

function createMaxlinkWebhookClient({
    url,
    secret,
    timeoutMs,
    httpClient = axios,
    now = Date.now
}) {
    return {
        async send(event) {
            const body = JSON.stringify(buildWebhookPayload(event));
            const timestamp = Math.floor(now() / 1000);
            await httpClient.post(url, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Maxlink-Webhook-Signature': signWebhookBody(body, timestamp, secret),
                    'X-Maxlink-Webhook-Timestamp': String(timestamp)
                },
                timeout: timeoutMs,
                validateStatus: status => status >= 200 && status < 300
            });
        }
    };
}

function normalizeOccurredAt(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value !== 'string') {
        throw new TypeError('occurred_at must be a database timestamp');
    }
    const mysqlTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;
    if (!mysqlTimestamp.test(value)) {
        throw new TypeError('occurred_at must be a UTC MySQL timestamp');
    }
    return `${value.replace(' ', 'T')}Z`;
}

module.exports = {
    buildWebhookPayload,
    createMaxlinkWebhookClient,
    normalizeOccurredAt,
    signWebhookBody
};
