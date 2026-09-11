const db = require('../config/database');

// 연결된 차단 기록을 사용하므로 기존 일정의 실제 차단 상태를 그대로 유지한다.
const EVENT_SELECT = `SELECT ae.*, EXISTS (
    SELECT 1 FROM consultation_blocked_slots blocks
    WHERE blocks.academy_event_id = ae.id AND blocks.academy_id = ae.academy_id
) AS block_consultation`;

function serialize(event) {
    return event ? { ...event, block_consultation: Boolean(event.block_consultation) } : null;
}

async function withTransaction(work) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function findEvents(academyId, filters = {}) {
    let query = `${EVENT_SELECT}, u.name AS created_by_name
        FROM academy_events ae LEFT JOIN users u ON ae.created_by = u.id
        WHERE ae.academy_id = ?`;
    const params = [academyId];
    if (filters.start_date) { query += ' AND ae.event_date >= ?'; params.push(filters.start_date); }
    if (filters.end_date) { query += ' AND ae.event_date <= ?'; params.push(filters.end_date); }
    if (filters.event_type) { query += ' AND ae.event_type = ?'; params.push(filters.event_type); }
    const [events] = await db.query(`${query} ORDER BY ae.event_date ASC, ae.start_time ASC`, params);
    return events.map(serialize);
}

async function findEvent(eventId, academyId, connection = db, lock = false) {
    const [events] = await connection.query(
        `${EVENT_SELECT} FROM academy_events ae WHERE ae.id = ? AND ae.academy_id = ?${lock ? ' FOR UPDATE' : ''}`,
        [eventId, academyId]
    );
    return serialize(events[0]);
}

function eventValues(event) {
    return [event.title, event.description || null, event.event_type, event.event_date,
        event.start_time || null, event.end_time || null, event.is_all_day, event.is_holiday, event.color];
}

async function insertEvent(connection, academyId, userId, event) {
    const [result] = await connection.execute(
        `INSERT INTO academy_events
         (academy_id, title, description, event_type, event_date, start_time, end_time, is_all_day, is_holiday, color, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [academyId, ...eventValues(event), userId]
    );
    return result.insertId;
}

async function updateEvent(connection, eventId, academyId, event) {
    await connection.execute(
        `UPDATE academy_events SET title = ?, description = ?, event_type = ?, event_date = ?,
         start_time = ?, end_time = ?, is_all_day = ?, is_holiday = ?, color = ?
         WHERE id = ? AND academy_id = ?`,
        [...eventValues(event), eventId, academyId]
    );
}

async function deleteEvent(connection, eventId, academyId) {
    await connection.execute('DELETE FROM academy_events WHERE id = ? AND academy_id = ?', [eventId, academyId]);
}

async function removeConsultationBlocks(connection, eventId, academyId) {
    await connection.execute(
        'DELETE FROM consultation_blocked_slots WHERE academy_event_id = ? AND academy_id = ?',
        [eventId, academyId]
    );
}

async function addConsultationBlock(connection, eventId, academyId, event, slot) {
    // 다른 일정이나 수동 차단의 소유권을 덮어쓰지 않는다. 충돌하면 전체 저장을 롤백한다.
    await connection.execute(
        `INSERT INTO consultation_blocked_slots
         (academy_id, blocked_date, time_slot, is_all_day, reason, blocked_by, academy_event_id)
         VALUES (?, ?, ?, 0, ?, 'system', ?)`,
        [academyId, event.event_date, slot, `${event.is_holiday ? '휴일' : '일정'}: ${event.title}`, eventId]
    );
}

async function reopenClasses(connection, eventId, academyId) {
    await connection.execute(
        `UPDATE class_schedules SET is_closed = FALSE, close_reason = NULL, academy_event_id = NULL
         WHERE academy_event_id = ? AND academy_id = ?`,
        [eventId, academyId]
    );
}

async function closeClasses(connection, eventId, academyId, event) {
    await connection.execute(
        `UPDATE class_schedules SET is_closed = TRUE, close_reason = ?, academy_event_id = ?
         WHERE academy_id = ? AND class_date = ?`,
        [`휴일: ${event.title}`, eventId, academyId, event.event_date]
    );
}

module.exports = {
    withTransaction, findEvents, findEvent, insertEvent, updateEvent, deleteEvent,
    removeConsultationBlocks, addConsultationBlock, reopenClasses, closeClasses
};
