jest.mock('../../config/database', () => ({}));
const { eventBody, eventId, marker, syncEvent } = require('../../services/google/calendarEvent');
const { academyEventBody } = require('../../services/google/academyEventBody');
const { ensureCalendar } = require('../../services/google/ensureCalendar');
const { seal, unseal } = require('../../services/google/security');
const { config, SCOPES } = require('../../config/google');
const row = { academy_id: 7, connection_key: 'synthetic', calendar_id: 'calendar' };
const consultation = { id: 5, preferred_date: '2030-01-02', preferred_time: '23:45:00', student_name: '합성', slot_duration: 30 };
beforeEach(() => { process.env.GOOGLE_CALENDAR_NAMESPACE = 'test'; process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32); });
test('tokens use authenticated academy-bound encryption and require configured secrets', () => {
    const token = seal('synthetic-secret', 7);
    expect(token).not.toContain('synthetic-secret');
    expect(unseal(token, 7)).toBe('synthetic-secret');
    expect(() => unseal(token, 8)).toThrow();
    expect(() => unseal(token.slice(0, -4), 7)).toThrow();
    expect(config({}).configured).toBe(false);
    expect(SCOPES.drive).toEqual(['https://www.googleapis.com/auth/drive.file']);
});
test('consultations cross midnight correctly; event IDs separate types, academies and generations', () => {
    const body = eventBody(consultation, 'test:7:5');
    expect(body.end.dateTime).toBe('2030-01-02T15:15:00.000Z');
    expect(body.extendedProperties.private['paca:consult']).toBe('test:7:5');
    expect(body).not.toHaveProperty('description');
    expect(new Set(['consultation', 'academy_event'].flatMap(t => [0, 1].map(g => eventId('key', t, 5, g)))).size).toBe(4);
    expect(eventId('key', 'consultation', 5, 0)).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(marker(7, 5)).not.toBe(marker(8, 5));
});
test.each(['work', 'academy', 'holiday', 'etc'])('academy %s supports all-day, timed and start-only events', event_type => {
    const base = { id: 5, event_type, title: '합성 일정', event_date: '2030-12-31', is_all_day: 1 };
    expect(academyEventBody(base, 'id').end).toEqual({ date: '2031-01-01', dateTime: null, timeZone: null });
    expect(academyEventBody({ ...base, is_all_day: 0, start_time: '23:30', end_time: '00:30' }, 'id').end.dateTime).toBe('2030-12-31T15:30:00.000Z');
    expect(academyEventBody({ ...base, is_all_day: 0, start_time: '10:00' }, 'id').end.dateTime).toBe('2030-12-31T01:30:00.000Z');
});
test('lost insert response retries with the same ID and recovers ownership before updating', async () => {
    let saved;
    const api = jest.fn(async (_c, _r, method, path, data) => {
        if (method === 'GET' && path !== '/events') {
            if (saved) return saved;
            throw Object.assign(new Error(), { status: 404 });
        }
        if (method === 'GET') return { items: [] };
        if (method === 'POST') { saved = data; throw new Error('response lost'); }
        return saved;
    });
    await expect(syncEvent(null, row, 'consultation', 5, consultation, { generation: 0 }, api)).rejects.toThrow();
    const result = await syncEvent(null, row, 'consultation', 5, consultation, { generation: 0 }, api);
    expect(result.eventId).toBe(saved.id);
    expect(api.mock.calls.filter(c => c[2] === 'POST')).toHaveLength(1);
    expect(api.mock.calls.filter(c => c[2] === 'PATCH')).toHaveLength(1);
});
test('cancel/delete removes only the matching event; already-deleted is successful', async () => {
    const api = jest.fn(async (_c, _r, method) => {
        if (method === 'GET') return { id: 'existing', extendedProperties: { private: { 'paca:consult': marker(7, 5) } } };
        throw Object.assign(new Error(), { status: 410 });
    });
    const result = await syncEvent(null, row, 'consultation', 5, { ...consultation, status: 'cancelled' }, { event_id: 'existing', generation: 0 }, api);
    expect(result).toEqual({ eventId: null, generation: 1 });
    expect(api.mock.calls[1][2]).toBe('DELETE');
    const foreign = async () => ({ id: 'existing', extendedProperties: { private: { 'paca:consult': marker(8, 5) } } });
    await expect(syncEvent(null, row, 'consultation', 5, consultation, { event_id: 'existing', generation: 0 }, foreign)).rejects.toThrow('EVENT_ID_CONFLICT');
});
test('reopened consultation replaces a tombstone; duplicated markers fail safely', async () => {
    const api = jest.fn(async (_c, _r, method, path, data) => {
        if (method === 'GET' && path !== '/events') return { status: 'cancelled' };
        if (method === 'GET') return { items: [] };
        return data;
    });
    const result = await syncEvent(null, row, 'consultation', 5, consultation, { generation: 0 }, api);
    expect(result.eventId).toBe(eventId(row.connection_key, 'consultation', 5, 1));
    api.mockImplementation(async (_c, _r, _m, path) => {
        if (path === '/events') return { items: [{}, {}] };
        throw Object.assign(new Error(), { status: 404 });
    });
    await expect(syncEvent(null, row, 'consultation', 5, consultation, { generation: 0 }, api)).rejects.toThrow('DUPLICATE_CALENDAR_EVENTS');
});
test('PACA calendar creation recovers the scoped calendar and ignores same-name calendars', async () => {
    const api = jest.fn().mockResolvedValueOnce({ items: [{ id: 'unrelated', summary: '파카 일정' }], nextPageToken: 'next' })
        .mockResolvedValueOnce({ items: [{ id: 'owned', description: 'paca:calendar:test:7' }] });
    expect((await ensureCalendar('fake', 7, api)).id).toBe('owned');
    expect(api.mock.calls.every(([args]) => args.method !== 'POST')).toBe(true);
    api.mockReset().mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ id: 'new' });
    await ensureCalendar('fake', 7, api);
    expect(api.mock.calls[1][0].data.summary).toBe('파카 일정');
});
test('event edits clear the old time representation when switching all-day and timed', async () => {
    let remote = { id: 'existing', ...academyEventBody({ title: 'holiday', event_date: '2030-01-02', is_all_day: 1 }, marker(7, 5)) };
    const api = async (_c, _r, method, _path, body) => {
        if (method === 'GET') return remote;
        remote = { ...remote, ...body, start: { ...remote.start, ...body.start }, end: { ...remote.end, ...body.end } };
        return remote;
    };
    const timed = { id: 5, title: 'work', event_date: '2030-01-03', start_time: '10:00', end_time: '11:00', is_all_day: 0 };
    await syncEvent(null, row, 'academy_event', 5, timed, { event_id: 'existing', generation: 0 }, api);
    expect(remote.start.date).toBeNull(); expect(remote.start.dateTime).toBeTruthy();
    await syncEvent(null, row, 'academy_event', 5, { ...timed, is_all_day: 1 }, { event_id: 'existing', generation: 0 }, api);
    expect(remote.start.dateTime).toBeNull(); expect(remote.start.date).toBe('2030-01-03');
    expect(() => eventBody({ ...consultation, preferred_date: '2030-02-30' }, 'id')).toThrow('CONSULTATION_TIME_INVALID');
});
