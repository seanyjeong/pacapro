const crypto = require('crypto');
const {
    buildWebhookPayload,
    createMaxlinkWebhookClient,
    signWebhookBody
} = require('../../services/maxlinkWebhookClient');

const SECRET = 'paca-webhook-test-secret-with-more-than-32-bytes';

describe('MAX LINK webhook client', () => {
    test('builds a terminal student event without personal information', () => {
        const payload = buildWebhookPayload({
            academy_id: 3,
            event_id: '10870cf0-9f2f-4c0d-ae08-4ba4148fd3c7',
            occurred_at: '2026-07-15 04:00:00.123456',
            source_student_id: '77',
            status: 'withdrawn'
        });

        expect(payload).toEqual({
            academyId: 3,
            eventId: '10870cf0-9f2f-4c0d-ae08-4ba4148fd3c7',
            occurredAt: '2026-07-15T04:00:00.123456Z',
            sourceStudentId: '77',
            status: 'withdrawn'
        });
        expect(JSON.stringify(payload)).not.toMatch(/name|phone|school/i);
    });

    test('signs timestamp and exact body with HMAC SHA-256', () => {
        const body = '{"eventId":"event-1"}';
        const timestamp = 1784088000;
        const expected = crypto
            .createHmac('sha256', SECRET)
            .update(`${timestamp}.${body}`)
            .digest('hex');

        expect(signWebhookBody(body, timestamp, SECRET)).toBe(`sha256=${expected}`);
    });

    test('posts the exact signed JSON body', async () => {
        const post = jest.fn().mockResolvedValue({ status: 200 });
        const client = createMaxlinkWebhookClient({
            httpClient: { post },
            now: () => 1784088000123,
            secret: SECRET,
            timeoutMs: 5000,
            url: 'https://api.maxlink.supermax.kr/v1/source-events/paca'
        });

        await client.send({
            academy_id: 3,
            event_id: '10870cf0-9f2f-4c0d-ae08-4ba4148fd3c7',
            occurred_at: '2026-07-15 04:00:00.123456',
            source_student_id: '77',
            status: 'deleted'
        });

        const [url, body, options] = post.mock.calls[0];
        expect(url).toBe('https://api.maxlink.supermax.kr/v1/source-events/paca');
        expect(typeof body).toBe('string');
        expect(options.headers['X-Maxlink-Webhook-Timestamp']).toBe('1784088000');
        expect(options.headers['X-Maxlink-Webhook-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
        expect(options.validateStatus(200)).toBe(true);
        expect(options.validateStatus(500)).toBe(false);
    });
});
