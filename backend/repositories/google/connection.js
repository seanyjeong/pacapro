const db = require('../../config/database');

async function locked(academyId, work) {
    const conn = await db.getConnection();
    const name = `paca-google:${academyId}`;
    let acquired = false;
    try {
        const [[row]] = await conn.query('SELECT GET_LOCK(?, 0) AS acquired', [name]);
        acquired = Number(row.acquired) === 1;
        if (!acquired) return { busy: true };
        return await work(conn);
    } finally {
        try { if (acquired) await conn.query('SELECT RELEASE_LOCK(?)', [name]); }
        catch (error) { conn.destroy(); throw error; }
        finally { conn.release(); }
    }
}
async function get(conn, academyId) {
    const [[row]] = await conn.query('SELECT * FROM google_connections WHERE academy_id = ?', [academyId]);
    return row;
}
async function status(academyId) { return get(db, academyId); }
async function save(conn, row) {
    await conn.query(`INSERT INTO google_connections
        (academy_id, account_id, email, calendar_id, connection_key, access_token, refresh_token, expires_at, scopes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE
        account_id=VALUES(account_id), email=VALUES(email), calendar_id=VALUES(calendar_id),
        connection_key=VALUES(connection_key), access_token=VALUES(access_token), refresh_token=VALUES(refresh_token),
        expires_at=VALUES(expires_at), scopes=VALUES(scopes), calendar_enabled=0, drive_enabled=0, sheets_enabled=0,
        last_error=NULL`, [row.academy_id, row.account_id, row.email, row.calendar_id, row.connection_key,
        row.access_token, row.refresh_token, row.expires_at, row.scopes]);
}
async function tokens(conn, academyId, access, refresh, expires) {
    await conn.query('UPDATE google_connections SET access_token=?, refresh_token=?, expires_at=?, last_error=NULL WHERE academy_id=?',
        [access, refresh, expires, academyId]);
}
async function setCalendar(conn, academyId, id, key) {
    await conn.query('UPDATE google_connections SET calendar_id=?, connection_key=? WHERE academy_id=?', [id, key, academyId]);
}
async function error(conn, academyId, code) {
    await conn.query('UPDATE google_connections SET last_error=? WHERE academy_id=?', [code, academyId]);
}
async function setService(conn, academyId, service, enabled) {
    const columns = { calendar: 'calendar_enabled', drive: 'drive_enabled', sheets: 'sheets_enabled' };
    if (!Object.hasOwn(columns, service)) throw new Error('INVALID_SERVICE');
    await conn.query(`UPDATE google_connections SET ${columns[service]}=? WHERE academy_id=?`, [enabled, academyId]);
}
async function disconnect(conn, academyId) {
    await conn.query(`UPDATE google_connections SET access_token=NULL, refresh_token=NULL,
        calendar_enabled=0, drive_enabled=0, sheets_enabled=0, last_error=NULL WHERE academy_id=?`, [academyId]);
    await conn.query('DELETE FROM google_oauth_states WHERE academy_id=?', [academyId]);
}
async function issueState(row) {
    await db.query('DELETE FROM google_oauth_states WHERE expires_at < UNIX_TIMESTAMP() OR (academy_id=? AND user_id=?)', [row.academyId, row.userId]);
    await db.query(`INSERT INTO google_oauth_states (state_hash, browser_hash, academy_id, user_id, verifier, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)`, [row.stateHash, row.browserHash, row.academyId, row.userId, row.verifier, row.expiresAt]);
}
async function startState(stateHash, browserHash) {
    const [result] = await db.query(`UPDATE google_oauth_states SET started=1
        WHERE state_hash=? AND browser_hash=? AND started=0 AND expires_at > UNIX_TIMESTAMP()`, [stateHash, browserHash]);
    if (result.affectedRows !== 1) return null;
    const [[row]] = await db.query('SELECT * FROM google_oauth_states WHERE state_hash=?', [stateHash]);
    return row;
}
async function consumeState(stateHash, browserHash) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[row]] = await conn.query(`SELECT * FROM google_oauth_states
            WHERE state_hash=? AND browser_hash=? AND started=1 AND expires_at > UNIX_TIMESTAMP() FOR UPDATE`, [stateHash, browserHash]);
        if (row) await conn.query('DELETE FROM google_oauth_states WHERE state_hash=?', [stateHash]);
        await conn.commit();
        return row;
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
}
async function canManage(conn, userId, academyId) {
    const [[row]] = await conn.query(`SELECT id FROM users WHERE id=? AND academy_id=? AND role='owner'
        AND is_active=1 AND approval_status='approved' AND deleted_at IS NULL`, [userId, academyId]);
    return Boolean(row);
}
module.exports = { locked, get, status, save, tokens, setCalendar, error, setService, disconnect, issueState, startState, consumeState, canManage };
