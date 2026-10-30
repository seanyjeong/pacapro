const SCOPES = {
    calendar: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.calendars', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly'],
    drive: ['https://www.googleapis.com/auth/drive.file'],
    sheets: ['https://www.googleapis.com/auth/spreadsheets'],
};
const GOOGLE = {
    calendarName: '파카 일정',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    calendarUrl: 'https://www.googleapis.com/calendar/v3',
    scopes: ['openid', 'email', ...Object.values(SCOPES).flat()],
    stateSeconds: 600,
    timeoutMs: 10000,
    pollMs: 3000,
    batchSize: 20,
    retryBaseSeconds: 10,
    retryMaxSeconds: 3600,
    defaultDurationMinutes: 30,
    timeZone: 'Asia/Seoul',
    utcOffset: '+09:00',
};
function config(env = process.env) {
    const result = {
        clientId: env.GOOGLE_CLIENT_ID || '', clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: env.GOOGLE_REDIRECT_URI || '', returnUrl: env.GOOGLE_RETURN_URL || '',
        encryptionKey: env.GOOGLE_TOKEN_ENCRYPTION_KEY || '',
        namespace: env.GOOGLE_CALENDAR_NAMESPACE || '',
        workerEnabled: env.GOOGLE_CALENDAR_WORKER_ENABLED === 'true',
    };
    result.configured = Boolean(result.clientId && result.clientSecret && result.namespace &&
        /^[a-fA-F0-9]{64}$/.test(result.encryptionKey) && validUrl(result.redirectUri) && validUrl(result.returnUrl));
    return result;
}
function validUrl(value) {
    try {
        const url = new URL(value);
        return !url.username && !url.password && !url.hash && !url.search &&
            (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)));
    } catch { return false; }
}
module.exports = { config, SCOPES, GOOGLE };
