const RETRY_DELAYS_SECONDS = Object.freeze([5, 30, 120, 600, 3600]);
const MAX_FAILURE_CODE_LENGTH = 64;

async function dispatchMaxlinkWebhookBatch({ client, repository }) {
    const events = await repository.listPending();
    let delivered = 0;
    let failed = 0;

    for (const event of events) {
        try {
            await client.send(event);
            await repository.markDelivered(event.id);
            delivered += 1;
        } catch (error) {
            await repository.markFailed(
                event.id,
                safeFailureCode(error),
                retryDelaySeconds(event.attempt_count)
            );
            failed += 1;
        }
    }

    return { selected: events.length, delivered, failed };
}

function retryDelaySeconds(attemptCount) {
    const index = Math.min(
        Math.max(Number(attemptCount) || 0, 0),
        RETRY_DELAYS_SECONDS.length - 1
    );
    return RETRY_DELAYS_SECONDS[index];
}

function safeFailureCode(error) {
    if (typeof error?.code === 'string' && error.code.length > 0) {
        return error.code.slice(0, MAX_FAILURE_CODE_LENGTH);
    }
    const name = error?.constructor?.name;
    return (typeof name === 'string' && name ? name : 'DeliveryError')
        .slice(0, MAX_FAILURE_CODE_LENGTH);
}

module.exports = {
    RETRY_DELAYS_SECONDS,
    dispatchMaxlinkWebhookBatch,
    retryDelaySeconds,
    safeFailureCode
};
