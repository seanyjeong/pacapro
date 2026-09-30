const {
    dispatchMaxlinkWebhookBatch,
    retryDelaySeconds,
    safeFailureCode
} = require('../../services/maxlinkWebhookDispatcher');

const EVENT = {
    attempt_count: 0,
    event_id: '10870cf0-9f2f-4c0d-ae08-4ba4148fd3c7',
    id: 5
};

describe('MAX LINK webhook dispatcher', () => {
    test('marks successfully delivered events', async () => {
        const repository = {
            listPending: jest.fn().mockResolvedValue([EVENT]),
            markDelivered: jest.fn(),
            markFailed: jest.fn()
        };
        const client = { send: jest.fn().mockResolvedValue(undefined) };

        const result = await dispatchMaxlinkWebhookBatch({ client, repository });

        expect(result).toEqual({ delivered: 1, failed: 0, selected: 1 });
        expect(repository.markDelivered).toHaveBeenCalledWith(5);
        expect(repository.markFailed).not.toHaveBeenCalled();
    });

    test('keeps a failed event and schedules a bounded retry', async () => {
        const repository = {
            listPending: jest.fn().mockResolvedValue([EVENT]),
            markDelivered: jest.fn(),
            markFailed: jest.fn()
        };
        const error = Object.assign(new Error('request failed with a private URL'), {
            code: 'ECONNREFUSED'
        });
        const client = { send: jest.fn().mockRejectedValue(error) };

        const result = await dispatchMaxlinkWebhookBatch({ client, repository });

        expect(result).toEqual({ delivered: 0, failed: 1, selected: 1 });
        expect(repository.markFailed).toHaveBeenCalledWith(5, 'ECONNREFUSED', 5);
        expect(repository.markDelivered).not.toHaveBeenCalled();
    });

    test('caps retry delay and stores only a safe failure code', () => {
        expect(retryDelaySeconds(100)).toBe(3600);
        expect(safeFailureCode(new Error('https://secret.example/path'))).toBe('Error');
        expect(safeFailureCode({ code: 'E'.repeat(100) })).toHaveLength(64);
    });
});
