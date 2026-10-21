const run = process.env.GOOGLE_TEST_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__googleTestDb);
jest.mock('../../utils/logger', () => ({ warn: jest.fn() }));
jest.mock('axios', () => jest.fn());
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

run('Google integration isolated MySQL outbox', () => {
    let db, admin, worker, queue, connections, service;
    const database = `paca_google_test_${process.pid}`;
    async function migrate(name) {
        const sql = fs.readFileSync(path.join(__dirname, '../../migrations', name), 'utf8');
        const [before, triggers = ''] = sql.split('DELIMITER $$');
        for (const statement of before.split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement);
        for (const statement of triggers.replace('DELIMITER ;', '').split('$$').map(s => s.trim()).filter(Boolean)) await db.query(statement);
    }
    const insert = (id, academy = 7, type = 'new_registration') => db.query(`INSERT INTO consultations
        (id, academy_id, consultation_type, preferred_date, preferred_time, student_name, status)
        VALUES (?, ?, ?, '2030-01-01', '10:00:00', 'synthetic', 'confirmed')`, [id, academy, type]);
    const count = async () => (await db.query('SELECT * FROM google_calendar_outbox'))[0];
    beforeAll(async () => {
        const port = Number(process.env.GOOGLE_TEST_MYSQL_PORT);
        if (!Number.isSafeInteger(port) || port < 10000) throw new Error('Dedicated loopback port >=10000 required');
        const options = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true };
        admin = await mysql.createConnection(options);
        await admin.query(`CREATE DATABASE ${database}`);
        db = mysql.createPool({ ...options, database });
        global.__googleTestDb = db;
        await db.query(`CREATE TABLE consultations (id BIGINT PRIMARY KEY, academy_id BIGINT NOT NULL,
            consultation_type VARCHAR(40), preferred_date DATE, preferred_time TIME, student_name TEXT, status VARCHAR(30)) ENGINE=InnoDB`);
        await db.query('CREATE TABLE consultation_settings (academy_id BIGINT PRIMARY KEY, slot_duration INT) ENGINE=InnoDB');
        await db.query('CREATE TABLE student_consultations (id BIGINT PRIMARY KEY, academy_id BIGINT, consultation_id BIGINT, general_memo TEXT) ENGINE=InnoDB');
        await db.query(`CREATE TABLE academy_events (id BIGINT PRIMARY KEY, academy_id BIGINT, title TEXT,
            description TEXT, event_type VARCHAR(30), event_date DATE, start_time TIME, end_time TIME, is_all_day BOOLEAN) ENGINE=InnoDB`);
        await db.query(`CREATE TABLE users (id BIGINT PRIMARY KEY, academy_id BIGINT, role VARCHAR(30), is_active BOOLEAN,
            approval_status VARCHAR(30), deleted_at DATETIME) ENGINE=InnoDB`);
        await migrate('20261022_google_integration.mysql');
        worker = require('../../services/google/calendarWorker'); queue = require('../../repositories/google/calendar');
        connections = require('../../repositories/google/connection'); service = require('../../services/google/connection');
        process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
        process.env.GOOGLE_CALENDAR_NAMESPACE = 'synthetic';
        process.env.GOOGLE_CLIENT_ID = 'synthetic'; process.env.GOOGLE_CLIENT_SECRET = 'synthetic';
        process.env.GOOGLE_REDIRECT_URI = 'http://localhost:8339/paca/google-integration/callback';
        process.env.GOOGLE_RETURN_URL = 'http://localhost:3339/settings';
    });
    beforeEach(async () => {
        for (const table of ['consultations', 'student_consultations', 'academy_events', 'google_calendar_events',
            'google_sync_versions', 'google_calendar_outbox', 'google_oauth_states', 'google_connections', 'users']) {
            await db.query(`TRUNCATE TABLE ${table}`);
        }
        const { GOOGLE } = require('../../config/google');
        for (const academyId of [7, 8]) await connections.save(db, { academy_id: academyId,
            account_id: `account-${academyId}`, email: 'synthetic@example.invalid', calendar_id: `calendar-${academyId}`,
            connection_key: `key-${academyId}`, access_token: 'encrypted', refresh_token: 'encrypted', expires_at: 0,
            scopes: GOOGLE.scopes.join(' ') });
        await connections.setService(db, 7, 'calendar', true);
    });
    afterAll(async () => {
        if (db) await db.end();
        if (admin) { await admin.query(`DROP DATABASE IF EXISTS ${database}`); await admin.end(); }
    });
    test('all consultation types, linked records and all academy event types share transactional triggers', async () => {
        await insert(1); await insert(2, 7, 'learning'); await insert(3, 8);
        await db.query("UPDATE consultations SET preferred_time='12:00', status='cancelled' WHERE id=1");
        await db.query('DELETE FROM consultations WHERE id=2');
        await db.query("INSERT INTO student_consultations VALUES (1,7,1,'memo')");
        await db.query("UPDATE student_consultations SET general_memo='changed' WHERE id=1");
        await db.query('DELETE FROM student_consultations WHERE id=1');
        for (const [i, type] of ['work', 'academy', 'holiday', 'etc'].entries()) {
            await db.query("INSERT INTO academy_events (id,academy_id,title,event_type,event_date,is_all_day) VALUES (?,7,'event',?,'2030-01-01',1)", [i + 1, type]);
            await db.query("UPDATE academy_events SET title='changed' WHERE id=?", [i + 1]);
            await db.query('DELETE FROM academy_events WHERE id=?', [i + 1]);
        }
        const rows = await count();
        expect(rows.filter(r => r.resource_type === 'academy_event')).toHaveLength(12);
        expect(rows.filter(r => r.resource_type === 'consultation')).toHaveLength(8);
        expect(Object.keys(rows[0]).sort()).toEqual(['academy_id', 'resource_type', 'resource_id', 'version', 'attempts', 'available_at', 'last_error'].sort());
        const conn = await db.getConnection();
        await conn.beginTransaction();
        await conn.query("UPDATE consultations SET preferred_time='17:00' WHERE id=1");
        await conn.rollback(); conn.release();
        expect(await count()).toHaveLength(rows.length);
        expect((await db.query('SELECT preferred_time FROM consultations WHERE id=1'))[0][0].preferred_time).toBe('12:00:00');
    });
    test('latest snapshot coalesces old signals, preserves concurrent changes and isolates disabled academy', async () => {
        await insert(1); await insert(2, 8);
        await db.query("UPDATE consultations SET preferred_time='13:00' WHERE id=1");
        const sync = jest.fn(async (_c, row, type, id, latest) => {
            expect(row.academy_id).toBe('7'); expect(type).toBe('consultation');
            expect(latest.preferred_time).toBe('13:00:00');
            await db.query("UPDATE consultations SET preferred_time='14:00' WHERE id=1");
            return { eventId: 'remote-event', generation: 0 };
        });
        await worker.processAcademy(7, sync); await worker.processAcademy(8, sync);
        expect(sync).toHaveBeenCalledTimes(1);
        expect((await count()).filter(r => r.academy_id === '7').map(r => r.version)).toEqual(['3']);
        const current = await queue.latest(db, 7, 'consultation', 1);
        expect(current.preferred_time).toBe('14:00:00');
    });
    test('failure persists retry and same-academy workers/settings cannot overlap', async () => {
        await insert(1);
        await worker.processAcademy(7, async () => { throw Object.assign(new Error('private provider response'), { code: 'GOOGLE_503' }); });
        const [job] = await count();
        expect(job.attempts).toBe(1); expect(job.last_error).toBe('GOOGLE_503');
        const sync = jest.fn(); await worker.processAcademy(7, sync); expect(sync).not.toHaveBeenCalled();
        await connections.locked(7, async () => {
            expect(await worker.processAcademy(7, sync)).toEqual({ busy: true });
            await expect(service.setService(7, 'calendar', false)).rejects.toMatchObject({ code: 'GOOGLE_BUSY' });
        });
        await service.setService(7, 'calendar', false);
        await service.setService(7, 'calendar', true);
        expect((await count())[0].attempts).toBe(0);
        await worker.processAcademy(7, async () => ({ eventId: 'retry-success', generation: 0 }));
        expect(await count()).toHaveLength(0);
    });
    test('deleted/moved resources keep tombstones; the old academy receives deletion and the new one creation', async () => {
        await insert(1);
        await db.query('UPDATE consultations SET academy_id=8 WHERE id=1');
        expect((await queue.latest(db, 7, 'consultation', 1)).id).toBeNull();
        expect((await queue.latest(db, 8, 'consultation', 1)).id).toBe('1');
        await db.query('DELETE FROM consultations WHERE id=1');
        expect((await queue.latest(db, 8, 'consultation', 1)).id).toBeNull();
    });
    test('OAuth state is browser-bound, single-use and tokens never leave the status API', async () => {
        const start = new URL((await service.authorize({ id: 1, academyId: 7 })).url);
        const state = start.searchParams.get('state'), ticket = start.searchParams.get('ticket');
        await expect(service.start(state, 'wrong')).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
        const google = new URL((await service.start(state, ticket)).url);
        expect(google.searchParams.get('code_challenge_method')).toBe('S256');
        await expect(service.callback({ state, error: 'access_denied' }, 'wrong')).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
        await expect(service.callback({ state, error: 'access_denied' }, ticket)).rejects.toMatchObject({ code: 'GOOGLE_CONSENT_DENIED' });
        await expect(service.callback({ state, code: 'synthetic' }, ticket)).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
        expect(JSON.stringify(await service.status(7))).not.toMatch(/encrypted|refresh_token|access_token/);
        await service.disconnect(7);
        expect((await connections.status(7)).refresh_token).toBeNull();
        expect((await connections.status(8)).refresh_token).toBe('encrypted');
    });
    test('OAuth success stores encrypted common tokens, partial service consent and refresh rotation', async () => {
        const axios = require('axios');
        const { GOOGLE } = require('../../config/google');
        const { unseal } = require('../../services/google/security');
        const { accessToken } = require('../../services/google/client');
        await db.query("INSERT INTO users VALUES (1,7,'owner',1,'approved',NULL)");
        const url = new URL((await service.authorize({ id: 1, academyId: 7 })).url);
        const state = url.searchParams.get('state'), ticket = url.searchParams.get('ticket');
        await service.start(state, ticket);
        axios.mockReset().mockResolvedValueOnce({ data: { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: GOOGLE.scopes.join(' ') } })
            .mockResolvedValueOnce({ data: { sub: 'new-account', email: 'synthetic@example.invalid', email_verified: true } });
        await service.callback({ state, code: 'synthetic' }, ticket);
        const row = await connections.status(7);
        expect(unseal(row.refresh_token, 7)).toBe('refresh');
        expect(row.calendar_id).toBe('');
        expect(row.calendar_enabled).toBe(0);
        expect((await service.status(7)).services.sheets.granted).toBe(true);
        axios.mockResolvedValueOnce({ data: { items: [] } }).mockResolvedValueOnce({ data: { id: 'dedicated-calendar' } });
        await service.setService(7, 'calendar', true);
        expect((await connections.status(7)).calendar_id).toBe('dedicated-calendar');
        axios.mockResolvedValueOnce({ data: { access_token: 'rotated-access', refresh_token: 'rotated-refresh', expires_in: 3600 } });
        await connections.locked(7, conn => accessToken(conn, row, true));
        expect(unseal((await connections.status(7)).refresh_token, 7)).toBe('rotated-refresh');
        expect(axios.mock.calls[0][0].data).toContain('code_verifier=');
    });
    test('partial permissions cannot enable calendar; revoked owners cannot finish OAuth', async () => {
        const axios = require('axios');
        await db.query("UPDATE google_connections SET scopes='openid https://www.googleapis.com/auth/drive.file' WHERE academy_id=7");
        await expect(service.setService(7, 'calendar', true)).rejects.toMatchObject({ code: 'GOOGLE_PERMISSION_REQUIRED' });
        await service.setService(7, 'drive', true);
        expect((await service.status(7)).services.drive.enabled).toBe(true);
        const url = new URL((await service.authorize({ id: 1, academyId: 7 })).url);
        const state = url.searchParams.get('state'), ticket = url.searchParams.get('ticket');
        await service.start(state, ticket);
        axios.mockClear();
        await expect(service.callback({ state, code: 'synthetic' }, ticket)).rejects.toMatchObject({ code: 'GOOGLE_FORBIDDEN' });
        expect(axios).not.toHaveBeenCalled();
    });
    test('down migration removes only integration objects', async () => {
        await migrate('20261022_google_integration.down.mysql');
        await insert(20);
        expect((await db.query("SHOW TABLES LIKE 'google_%'"))[0]).toHaveLength(0);
        await migrate('20261022_google_integration.mysql');
    });
});
