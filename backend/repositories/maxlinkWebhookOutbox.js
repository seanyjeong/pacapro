const BATCH_SIZE = 25;

function createMaxlinkWebhookOutboxRepository(pool) {
    return {
        async listPending() {
            const [rows] = await pool.execute(
                `SELECT id, event_id, academy_id, source_student_id, status,
                        occurred_at, attempt_count
                 FROM maxlink_webhook_outbox
                 WHERE processed_at IS NULL
                   AND next_attempt_at <= UTC_TIMESTAMP(6)
                 ORDER BY id ASC
                 LIMIT ${BATCH_SIZE}`
            );
            return rows;
        },

        async markDelivered(id) {
            await pool.execute(
                `UPDATE maxlink_webhook_outbox
                 SET processed_at = UTC_TIMESTAMP(6), last_error = NULL
                 WHERE id = ? AND processed_at IS NULL`,
                [id]
            );
        },

        async markFailed(id, failureCode, retrySeconds) {
            await pool.execute(
                `UPDATE maxlink_webhook_outbox
                 SET attempt_count = attempt_count + 1,
                     last_error = ?,
                     next_attempt_at = DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? SECOND)
                 WHERE id = ? AND processed_at IS NULL`,
                [failureCode, retrySeconds, id]
            );
        }
    };
}

module.exports = {
    BATCH_SIZE,
    createMaxlinkWebhookOutboxRepository
};
