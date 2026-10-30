const { GOOGLE, config } = require('../../config/google');
const connection = require('../../repositories/google/connection');
const queue = require('../../repositories/google/calendar');
const { syncEvent } = require('./calendarEvent');
const { hasScope } = require('./client');
const logger = require('../../utils/logger');

async function processAcademy(academyId, sync = syncEvent) {
    return connection.locked(academyId, async conn => {
        const row = await connection.get(conn, academyId);
        if (!row?.calendar_enabled || !row.refresh_token || !hasScope(row, 'calendar')) return;
        const job = await queue.next(conn, academyId);
        if (!job) return;
        try {
            const snapshot = await queue.latest(conn, academyId, job.resource_type, job.resource_id);
            if (!snapshot) throw new Error('MISSING_RESOURCE_VERSION');
            const mapping = await queue.mapping(conn, row.connection_key, job.resource_type, job.resource_id);
            const result = await sync(conn, row, job.resource_type, job.resource_id, snapshot, mapping);
            await queue.completed(conn, row, job.resource_type, job.resource_id, snapshot.version, result.eventId, result.generation);
        } catch (error) {
            const code = typeof error.code === 'string' && /^[A-Z_0-9]{1,64}$/.test(error.code) ? error.code : 'CALENDAR_SYNC_FAILED';
            const delay = Math.min(GOOGLE.retryMaxSeconds, GOOGLE.retryBaseSeconds * 2 ** Math.min(job.attempts, 10));
            await queue.failed(conn, academyId, job, code, delay);
            await connection.error(conn, academyId, code);
            logger.warn('google_calendar_retry', { academy_id: academyId, code });
        }
    });
}
async function tick() {
    if (!config().configured || !config().workerEnabled) return;
    for (const row of await queue.candidates()) await processAcademy(row.academy_id);
}
module.exports = { tick, processAcademy };
