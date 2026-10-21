const { GOOGLE, config } = require('../../config/google');
const { request, GoogleError } = require('./client');
async function ensureCalendar(accessToken, academyId, api = request) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const description = `paca:calendar:${config().namespace}:${academyId}`;
    const matches = [];
    let pageToken;
    do {
        const page = await api({ url: `${GOOGLE.calendarUrl}/users/me/calendarList`, headers,
            params: { minAccessRole: 'owner', showHidden: true, pageToken } });
        matches.push(...(page.items || []).filter(c => c.description === description && !c.deleted));
        pageToken = page.nextPageToken;
    } while (pageToken);
    if (matches.length > 1) throw new GoogleError('DUPLICATE_PACA_CALENDARS');
    if (matches.length) return matches[0];
    return api({ method: 'POST', url: `${GOOGLE.calendarUrl}/calendars`, headers,
        data: { summary: GOOGLE.calendarName, description, timeZone: GOOGLE.timeZone } });
}
module.exports = { ensureCalendar };
