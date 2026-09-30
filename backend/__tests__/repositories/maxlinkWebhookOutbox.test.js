const { createMaxlinkWebhookOutboxRepository } = require('../../repositories/maxlinkWebhookOutbox');

describe('MAX LINK webhook outbox repository', () => {
    test('selects only due undelivered events in stable order', async () => {
        const execute = jest.fn().mockResolvedValue([[{ id: 1 }]]);
        const repository = createMaxlinkWebhookOutboxRepository({ execute });

        await expect(repository.listPending()).resolves.toEqual([{ id: 1 }]);
        expect(execute.mock.calls[0][0]).toMatch(/processed_at IS NULL/);
        expect(execute.mock.calls[0][0]).toMatch(/next_attempt_at <= UTC_TIMESTAMP\(6\)/);
        expect(execute.mock.calls[0][0]).toMatch(/ORDER BY id ASC/);
    });

    test('records delivery without removing the audit event', async () => {
        const execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);
        const repository = createMaxlinkWebhookOutboxRepository({ execute });

        await repository.markDelivered(9);

        expect(execute.mock.calls[0][0]).toMatch(/SET processed_at = UTC_TIMESTAMP\(6\)/);
        expect(execute.mock.calls[0][0]).not.toMatch(/DELETE/i);
        expect(execute.mock.calls[0][1]).toEqual([9]);
    });
});
