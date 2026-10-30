const db = require('../../config/database');
const { GOOGLE } = require('../../config/google');
async function seed(conn, academyId) {
    await conn.query(`INSERT IGNORE INTO google_sync_versions (academy_id, resource_type, resource_id)
        SELECT academy_id, 'consultation', id FROM consultations WHERE academy_id=?`, [academyId]);
    await conn.query(`INSERT IGNORE INTO google_sync_versions (academy_id, resource_type, resource_id)
        SELECT academy_id, 'academy_event', id FROM academy_events WHERE academy_id=?`, [academyId]);
    await conn.query(`INSERT IGNORE INTO google_calendar_outbox (academy_id, resource_type, resource_id, version)
        SELECT academy_id, resource_type, resource_id, version FROM google_sync_versions WHERE academy_id=?`, [academyId]);
    await conn.query('UPDATE google_calendar_outbox SET available_at=NOW(3), attempts=0 WHERE academy_id=?', [academyId]);
}
async function candidates() {
    const [rows] = await db.query(`SELECT DISTINCT o.academy_id FROM google_calendar_outbox o
        JOIN google_connections g ON g.academy_id=o.academy_id
        WHERE g.calendar_enabled=1 AND g.refresh_token IS NOT NULL AND o.available_at <= NOW(3)
        ORDER BY o.academy_id LIMIT ?`, [GOOGLE.batchSize]);
    return rows;
}
async function next(conn, academyId) {
    const [[row]] = await conn.query(`SELECT resource_type, resource_id, version, attempts FROM google_calendar_outbox
        WHERE academy_id=? AND available_at <= NOW(3) ORDER BY available_at, resource_id, version LIMIT 1`, [academyId]);
    return row;
}
async function latest(conn, academyId, type, id) {
    // One consistent snapshot; external API calls never hold business row locks.
    const queries = {
        consultation: `SELECT v.version, c.id, c.preferred_date, c.preferred_time, c.status, c.student_name, s.slot_duration
            FROM google_sync_versions v LEFT JOIN consultations c ON c.id=v.resource_id AND c.academy_id=v.academy_id
            LEFT JOIN consultation_settings s ON s.academy_id=v.academy_id`,
        academy_event: `SELECT v.version, e.id, e.title, e.description, e.event_date, e.start_time, e.end_time, e.is_all_day
            FROM google_sync_versions v LEFT JOIN academy_events e ON e.id=v.resource_id AND e.academy_id=v.academy_id`,
    };
    if (!Object.hasOwn(queries, type)) throw new Error('INVALID_RESOURCE');
    const [[row]] = await conn.query(`${queries[type]} WHERE v.academy_id=? AND v.resource_type=? AND v.resource_id=?`, [academyId, type, id]);
    return row;
}
async function mapping(conn, key, type, id) {
    const [[row]] = await conn.query('SELECT * FROM google_calendar_events WHERE connection_key=? AND resource_type=? AND resource_id=?', [key, type, id]);
    return row || { event_id: null, generation: 0 };
}
async function completed(conn, row, type, id, version, eventId, generation) {
    await conn.beginTransaction();
    try {
        await conn.query(`INSERT INTO google_calendar_events (connection_key, resource_type, resource_id, event_id, generation, synced_version)
            VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE event_id=VALUES(event_id), generation=VALUES(generation), synced_version=VALUES(synced_version)`,
        [row.connection_key, type, id, eventId, generation, version]);
        await conn.query('DELETE FROM google_calendar_outbox WHERE academy_id=? AND resource_type=? AND resource_id=? AND version<=?', [row.academy_id, type, id, version]);
        await conn.query('UPDATE google_connections SET last_synced_at=NOW(3), last_error=NULL WHERE academy_id=?', [row.academy_id]);
        await conn.commit();
    } catch (error) { await conn.rollback(); throw error; }
}
async function failed(conn, academyId, job, code, delay) {
    await conn.query(`UPDATE google_calendar_outbox SET attempts=attempts+1,
        available_at=TIMESTAMPADD(SECOND, ?, NOW(3)), last_error=?
        WHERE academy_id=? AND resource_type=? AND resource_id=? AND version=?`, [delay, code, academyId, job.resource_type, job.resource_id, job.version]);
}
module.exports = { seed, candidates, next, latest, mapping, completed, failed };
