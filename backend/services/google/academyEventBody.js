const { GOOGLE } = require('../../config/google');
const { GoogleError } = require('./client');
function academyEventBody(event, identifier) {
    const date = String(event.event_date || '').slice(0, 10);
    const day = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) throw new GoogleError('EVENT_TIME_INVALID');
    const body = { summary: event.title, description: event.description || '',
        extendedProperties: { private: { 'paca:event': identifier } } };
    if (event.is_all_day || !event.start_time) {
        day.setUTCDate(day.getUTCDate() + 1);
        return { ...body, start: { date, dateTime: null, timeZone: null },
            end: { date: day.toISOString().slice(0, 10), dateTime: null, timeZone: null } };
    }
    const parse = time => {
        if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) throw new GoogleError('EVENT_TIME_INVALID');
        return new Date(`${date}T${time.length === 5 ? time + ':00' : time}${GOOGLE.utcOffset}`);
    };
    const start = parse(event.start_time);
    // Google requires an end; a start-only PACA event uses the documented default duration.
    const end = event.end_time ? parse(event.end_time) : new Date(start.getTime() + GOOGLE.defaultDurationMinutes * 60000);
    if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
    return { ...body, start: { date: null, dateTime: start.toISOString(), timeZone: GOOGLE.timeZone },
        end: { date: null, dateTime: end.toISOString(), timeZone: GOOGLE.timeZone } };
}
module.exports = { academyEventBody };
