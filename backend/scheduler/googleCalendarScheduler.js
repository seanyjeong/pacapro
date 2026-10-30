const { GOOGLE, config } = require('../config/google');
const { tick } = require('../services/google/calendarWorker');
const logger = require('../utils/logger');

function initGoogleCalendarScheduler() {
    if (!config().configured || !config().workerEnabled) return;
    let running = false;
    const timer = setInterval(async () => {
        if (running) return;
        running = true;
        try { await tick(); }
        catch { logger.warn('google_calendar_worker_failed'); }
        finally { running = false; }
    }, GOOGLE.pollMs);
    timer.unref();
    return timer;
}
module.exports = { initGoogleCalendarScheduler };
