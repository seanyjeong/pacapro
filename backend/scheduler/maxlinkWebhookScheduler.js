const pool = require('../config/database');
const { getMaxlinkWebhookConfig } = require('../config/maxlinkWebhook');
const { createMaxlinkWebhookOutboxRepository } = require('../repositories/maxlinkWebhookOutbox');
const { createMaxlinkWebhookClient } = require('../services/maxlinkWebhookClient');
const { dispatchMaxlinkWebhookBatch } = require('../services/maxlinkWebhookDispatcher');
const logger = require('../utils/logger');

const DISPATCH_INTERVAL_MS = 5000;

function startMaxlinkWebhookScheduler() {
    const config = getMaxlinkWebhookConfig();
    const repository = createMaxlinkWebhookOutboxRepository(pool);
    const client = createMaxlinkWebhookClient(config);
    let isDispatching = false;

    const dispatch = async () => {
        if (isDispatching) return;
        isDispatching = true;
        try {
            const result = await dispatchMaxlinkWebhookBatch({ client, repository });
            if (result.failed > 0) {
                logger.warn('[MAX LINK] 웹훅 전달 재시도 예약', result);
            } else if (result.delivered > 0) {
                logger.info('[MAX LINK] 웹훅 전달 완료', result);
            }
        } catch (error) {
            logger.error('[MAX LINK] outbox 처리 실패', { code: error.code || error.name });
        } finally {
            isDispatching = false;
        }
    };

    void dispatch();
    setInterval(dispatch, DISPATCH_INTERVAL_MS);
    logger.info('[MAX LINK] 학생 상태 웹훅 스케줄러 시작');
}

module.exports = {
    DISPATCH_INTERVAL_MS,
    startMaxlinkWebhookScheduler
};
