const { GOOGLE, config } = require('../../config/google');
const { hash } = require('./security');
const { calendarRequest, GoogleError } = require('./client');
const { decrypt } = require('../maxEngineFullSecurity');
const { academyEventBody } = require('./academyEventBody');

function marker(academyId, id) { return `${config().namespace}:${academyId}:${id}`; }
function eventId(connectionKey, type, id, generation) { return `paca${hash(`${connectionKey}:${type}:${id}:${generation}`)}`; }
function eventBody(consultation, identifier) {
    const date = String(consultation.preferred_date || '').slice(0, 10);
    const time = String(consultation.preferred_time || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) {
        throw new GoogleError('CONSULTATION_TIME_INVALID');
    }
    const start = new Date(`${date}T${time.length === 5 ? time + ':00' : time}${GOOGLE.utcOffset}`);
    if (!Number.isFinite(start.getTime()) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
        throw new GoogleError('CONSULTATION_TIME_INVALID');
    }
    const duration = Number(consultation.slot_duration) || GOOGLE.defaultDurationMinutes;
    if (duration <= 0 || duration > 1440) throw new GoogleError('CONSULTATION_DURATION_INVALID');
    const name = consultation.student_name ? decrypt(consultation.student_name) : '';
    return { summary: name ? `상담 · ${name}` : '상담',
        start: { date: null, dateTime: start.toISOString(), timeZone: GOOGLE.timeZone },
        end: { date: null, dateTime: new Date(start.getTime() + duration * 60000).toISOString(), timeZone: GOOGLE.timeZone },
        extendedProperties: { private: { 'paca:consult': identifier } } };
}
async function syncEvent(conn, row, type, id, consultation, mapping, api = calendarRequest) {
    const identifier = marker(row.academy_id, id);
    const property = type === 'consultation' ? 'paca:consult' : 'paca:event';
    const removed = !consultation?.id || consultation.status === 'cancelled';
    let generation = Number(mapping.generation);
    let candidate = mapping.event_id || eventId(row.connection_key, type, id, generation);
    const call = (method, path, data, params) => api(conn, row, method, path, data, params);
    const path = value => `/events/${encodeURIComponent(value)}`;
    const own = event => {
        if (event.extendedProperties?.private?.[property] !== identifier) throw new GoogleError('EVENT_ID_CONFLICT');
        return event;
    };
    async function get(value) {
        try { return await call('GET', path(value)); }
        catch (error) {
            if (error.status === 404) return null;
            if (error.status === 410) return { id: value, status: 'cancelled' };
            throw error;
        }
    }
    let existing = await get(candidate);
    if (existing?.status === 'cancelled') {
        generation++;
        candidate = eventId(row.connection_key, type, id, generation);
        existing = null;
    }
    if (!existing) {
        const found = await call('GET', '/events', undefined, { privateExtendedProperty: `${property}=${identifier}`, showDeleted: false });
        // Do not silently choose one event if legacy duplicates exist.
        if (found.nextPageToken || found.items?.length > 1) throw new GoogleError('DUPLICATE_CALENDAR_EVENTS');
        existing = found.items?.[0] || null;
    }
    if (existing) own(existing);
    if (removed) {
        if (existing) {
            try { await call('DELETE', path(existing.id), undefined, { sendUpdates: 'none' }); }
            catch (error) { if (![404, 410].includes(error.status)) throw error; }
        }
        return { eventId: null, generation: generation + (existing ? 1 : 0) };
    }
    const body = type === 'consultation' ? eventBody(consultation, identifier) : academyEventBody(consultation, identifier);
    if (existing) {
        await call('PATCH', path(existing.id), body, { sendUpdates: 'none' });
        return { eventId: existing.id, generation };
    }
    try {
        const event = await call('POST', '/events', { ...body, id: candidate }, { sendUpdates: 'none' });
        return { eventId: event.id, generation };
    } catch (error) {
        if (error.status !== 409) throw error;
        // A previous insert may have succeeded before its response or local commit was lost.
        const event = await get(candidate);
        if (!event || event.status === 'cancelled') throw new GoogleError('EVENT_INSERT_RETRY');
        own(event);
        await call('PATCH', path(candidate), body, { sendUpdates: 'none' });
        return { eventId: candidate, generation };
    }
}
module.exports = { marker, eventId, eventBody, syncEvent };
