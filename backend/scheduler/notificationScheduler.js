/**
 * PACA 알림톡 내부 자동 발송 스케줄러.
 *
 * 기존 자동 발송 endpoint 6개를 같은 프로세스에서 호출한다.
 * 실제 외부 발송은 기존 route/service 로직이 담당하고, 이 파일은 시간 트리거만 담당한다.
 */

const cron = require('node-cron');
const logger = require('../utils/logger');

const DEFAULT_CRON = '5 * * * *';
const DEFAULT_TIMEZONE = 'Asia/Seoul';
const DEFAULT_BASE_URL = `http://127.0.0.1:${process.env.PORT || 8320}`;

const NOTIFICATION_JOBS = [
    { name: 'solapi-unpaid', path: '/paca/notifications/send-unpaid-today-auto' },
    { name: 'solapi-trial', path: '/paca/notifications/send-trial-today-auto' },
    { name: 'sens-unpaid', path: '/paca/notifications/send-unpaid-today-auto-sens' },
    { name: 'sens-trial', path: '/paca/notifications/send-trial-today-auto-sens' },
    { name: 'solapi-reminder', path: '/paca/notifications/send-reminder-auto' },
    { name: 'sens-reminder', path: '/paca/notifications/send-reminder-auto-sens' },
];

let scheduledTask = null;

function trimSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function getSchedulerConfig(env = process.env) {
    return {
        enabled: env.PACA_INTERNAL_NOTIFICATION_SCHEDULER === 'true',
        cronExpression: env.PACA_INTERNAL_NOTIFICATION_CRON || DEFAULT_CRON,
        timezone: env.PACA_INTERNAL_NOTIFICATION_TIMEZONE || DEFAULT_TIMEZONE,
        baseUrl: trimSlash(env.PACA_INTERNAL_NOTIFICATION_BASE_URL || DEFAULT_BASE_URL),
        apiKey: env.PACA_NOTIFICATION_API_KEY || '',
    };
}

function buildJobUrl(baseUrl, path) {
    return `${trimSlash(baseUrl)}${path}`;
}

async function triggerNotificationJob(job, options = {}) {
    const fetchImpl = options.fetchImpl || global.fetch;
    const log = options.logger || logger;
    const baseUrl = options.baseUrl || getSchedulerConfig().baseUrl;
    const apiKey = options.apiKey || getSchedulerConfig().apiKey;

    if (!apiKey) {
        return { name: job.name, skipped: true, reason: 'missing_api_key' };
    }
    if (typeof fetchImpl !== 'function') {
        return { name: job.name, skipped: true, reason: 'missing_fetch' };
    }

    const url = buildJobUrl(baseUrl, job.path);
    const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
        },
        body: '{}',
    });

    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = { raw: text };
    }

    const result = {
        name: job.name,
        status: response.status,
        ok: response.ok,
        body,
    };

    if (!response.ok) {
        log.warn('[NotificationScheduler] 자동 발송 endpoint 실패', result);
    }
    return result;
}

async function runNotificationJobsOnce(options = {}) {
    const jobs = options.jobs || NOTIFICATION_JOBS;
    const results = [];

    for (const job of jobs) {
        try {
            results.push(await triggerNotificationJob(job, options));
        } catch (error) {
            const result = { name: job.name, ok: false, error: error.message };
            results.push(result);
            (options.logger || logger).error('[NotificationScheduler] 자동 발송 job 오류', result);
        }
    }

    return results;
}

function initNotificationScheduler(options = {}) {
    const config = { ...getSchedulerConfig(), ...options };
    const log = options.logger || logger;

    if (!config.enabled) {
        log.info('[NotificationScheduler] 비활성화 상태입니다. PACA_INTERNAL_NOTIFICATION_SCHEDULER=true 일 때만 실행합니다.');
        return null;
    }

    if (!config.apiKey) {
        log.warn('[NotificationScheduler] PACA_NOTIFICATION_API_KEY가 없어 자동 발송을 시작하지 않습니다.');
        return null;
    }

    if (scheduledTask) {
        log.info('[NotificationScheduler] 이미 실행 중입니다.');
        return scheduledTask;
    }

    scheduledTask = cron.schedule(
        config.cronExpression,
        () => runNotificationJobsOnce(config),
        { timezone: config.timezone }
    );

    log.info('[NotificationScheduler] 내부 알림톡 자동 발송 스케줄러 시작', {
        cron: config.cronExpression,
        timezone: config.timezone,
        jobs: NOTIFICATION_JOBS.map(job => job.name),
    });

    return scheduledTask;
}

function stopNotificationScheduler() {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }
}

module.exports = {
    NOTIFICATION_JOBS,
    buildJobUrl,
    getSchedulerConfig,
    initNotificationScheduler,
    runNotificationJobsOnce,
    stopNotificationScheduler,
    triggerNotificationJob,
};
