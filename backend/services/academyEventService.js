/**
 * Academy Event Service
 * 학원 일정 비즈니스 로직
 */

const db = require('../config/database');
const logger = require('../utils/logger');

const DEFAULT_COLORS = {
    work: '#f59e0b',
    academy: '#3b82f6',
    holiday: '#ef4444',
    etc: '#6b7280'
};

/**
 * 시간을 시간대(time_slot)로 변환
 */
function getTimeSlotFromTime(timeStr, isEndTime = false) {
    if (!timeStr) return null;
    const [hourStr, minStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const min = parseInt(minStr || '0', 10);

    if (isEndTime && min === 0) {
        if (hour === 12) return 'morning';
        if (hour === 18) return 'afternoon';
    }

    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}

/**
 * 휴일 지정 시 상담 차단 + 수업 휴강 처리
 */
async function applyHolidayBlocks(connection, academyId, eventDate, eventId, title) {
    const timeSlots = ['morning', 'afternoon', 'evening'];
    for (const slot of timeSlots) {
        await connection.execute(
            `INSERT INTO consultation_blocked_slots (academy_id, blocked_date, time_slot, reason, blocked_by, academy_event_id)
             VALUES (?, ?, ?, ?, 'system', ?)
             ON DUPLICATE KEY UPDATE reason = VALUES(reason), academy_event_id = VALUES(academy_event_id)`,
            [academyId, eventDate, slot, `휴일: ${title}`, eventId]
        );
    }

    await connection.execute(
        `UPDATE class_schedules
         SET is_closed = TRUE, close_reason = ?, academy_event_id = ?
         WHERE academy_id = ? AND class_date = ?`,
        [`휴일: ${title}`, eventId, academyId, eventDate]
    );
}

/**
 * 휴일 해제 시 상담 차단 + 수업 휴강 복구
 */
async function removeHolidayBlocks(connection, eventId) {
    await connection.execute(
        'DELETE FROM consultation_blocked_slots WHERE academy_event_id = ?',
        [eventId]
    );
    await connection.execute(
        `UPDATE class_schedules
         SET is_closed = FALSE, close_reason = NULL, academy_event_id = NULL
         WHERE academy_event_id = ?`,
        [eventId]
    );
}

/**
 * 일반 일정 시 해당 시간대 상담 차단
 */
async function applyEventBlocks(connection, academyId, eventDate, eventId, title, isAllDay, startTime, endTime) {
    let slotsToBlock = [];

    if (isAllDay) {
        slotsToBlock = ['morning', 'afternoon', 'evening'];
    } else if (startTime) {
        const startSlot = getTimeSlotFromTime(startTime, false);
        const endSlot = getTimeSlotFromTime(endTime, true) || startSlot;
        const allSlots = ['morning', 'afternoon', 'evening'];
        const startIdx = allSlots.indexOf(startSlot);
        const endIdx = allSlots.indexOf(endSlot);

        if (startIdx !== -1 && endIdx !== -1) {
            for (let i = startIdx; i <= endIdx; i++) {
                slotsToBlock.push(allSlots[i]);
            }
        }
    }

    for (const slot of slotsToBlock) {
        await connection.execute(
            `INSERT INTO consultation_blocked_slots (academy_id, blocked_date, time_slot, is_all_day, reason, blocked_by, academy_event_id)
             VALUES (?, ?, ?, 0, ?, 'system', ?)
             ON DUPLICATE KEY UPDATE reason = VALUES(reason), academy_event_id = VALUES(academy_event_id), is_all_day = 0`,
            [academyId, eventDate, slot, `일정: ${title}`, eventId]
        );
    }
}

/**
 * 일정 삭제/수정 시 상담 차단 해제
 */
async function removeEventBlocks(connection, eventId) {
    await connection.execute(
        'DELETE FROM consultation_blocked_slots WHERE academy_event_id = ?',
        [eventId]
    );
    await connection.execute(
        `UPDATE class_schedules
         SET is_closed = FALSE, close_reason = NULL, academy_event_id = NULL
         WHERE academy_event_id = ?`,
        [eventId]
    );
}

/**
 * 월별 학원 일정 조회
 */
async function getEvents(academyId, filters) {
    const { start_date, end_date, event_type } = filters;

    let query = `
        SELECT ae.*, u.name AS created_by_name
        FROM academy_events ae
        LEFT JOIN users u ON ae.created_by = u.id
        WHERE ae.academy_id = ?
    `;
    const params = [academyId];

    if (start_date) { query += ' AND ae.event_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND ae.event_date <= ?'; params.push(end_date); }
    if (event_type) { query += ' AND ae.event_type = ?'; params.push(event_type); }

    query += ' ORDER BY ae.event_date ASC, ae.start_time ASC';

    const [events] = await db.query(query, params);
    return { events };
}

/**
 * 특정 일정 조회
 */
async function getEventById(eventId, academyId) {
    const [events] = await db.query(
        'SELECT * FROM academy_events WHERE id = ? AND academy_id = ?',
        [eventId, academyId]
    );
    if (events.length === 0) return null;
    return events[0];
}

/**
 * 학원 일정 생성
 */
async function createEvent(academyId, userId, body) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            title, description, event_type = 'academy', event_date,
            start_time, end_time, is_all_day = true, is_holiday = false, color
        } = body;

        if (!title || !event_date) {
            return { status: 400, message: '제목과 날짜는 필수입니다.' };
        }

        const finalColor = color || DEFAULT_COLORS[event_type] || '#3b82f6';

        const [result] = await connection.execute(
            `INSERT INTO academy_events
             (academy_id, title, description, event_type, event_date, start_time, end_time, is_all_day, is_holiday, color, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                academyId, title, description || null, event_type || 'academy', event_date,
                start_time || null, end_time || null,
                is_all_day === undefined ? true : Boolean(is_all_day),
                is_holiday === undefined ? false : Boolean(is_holiday),
                finalColor, userId
            ]
        );

        const eventId = result.insertId;

        if (is_holiday) {
            await applyHolidayBlocks(connection, academyId, event_date, eventId, title);
        } else {
            await applyEventBlocks(connection, academyId, event_date, eventId, title, is_all_day, start_time, end_time);
        }

        await connection.commit();

        const [newEvent] = await db.query('SELECT * FROM academy_events WHERE id = ?', [eventId]);
        return { status: 201, message: '학원 일정이 등록되었습니다.', event: newEvent[0] };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * 학원 일정 수정
 */
async function updateEvent(eventId, academyId, body) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.query(
            'SELECT * FROM academy_events WHERE id = ? AND academy_id = ?',
            [eventId, academyId]
        );

        if (existing.length === 0) {
            return { status: 404, message: '일정을 찾을 수 없습니다.' };
        }

        const oldEvent = existing[0];
        const { title, description, event_type, event_date, start_time, end_time, is_all_day, is_holiday, color } = body;

        await connection.execute(
            `UPDATE academy_events SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                event_type = COALESCE(?, event_type),
                event_date = COALESCE(?, event_date),
                start_time = ?,
                end_time = ?,
                is_all_day = COALESCE(?, is_all_day),
                is_holiday = COALESCE(?, is_holiday),
                color = COALESCE(?, color)
             WHERE id = ?`,
            [
                title, description, event_type, event_date,
                start_time !== undefined ? start_time : oldEvent.start_time,
                end_time !== undefined ? end_time : oldEvent.end_time,
                is_all_day, is_holiday, color, eventId
            ]
        );

        const newIsHoliday = is_holiday !== undefined ? is_holiday : oldEvent.is_holiday;
        const newEventDate = event_date || oldEvent.event_date;
        const newTitle = title || oldEvent.title;

        if (oldEvent.is_holiday && !newIsHoliday) {
            await removeHolidayBlocks(connection, eventId);
        } else if (!oldEvent.is_holiday && newIsHoliday) {
            await applyHolidayBlocks(connection, academyId, newEventDate, eventId, newTitle);
        } else if (oldEvent.is_holiday && newIsHoliday && oldEvent.event_date !== newEventDate) {
            await removeHolidayBlocks(connection, eventId);
            await applyHolidayBlocks(connection, academyId, newEventDate, eventId, newTitle);
        }

        await connection.commit();

        const [updatedEvent] = await db.query('SELECT * FROM academy_events WHERE id = ?', [eventId]);
        return { status: 200, message: '학원 일정이 수정되었습니다.', event: updatedEvent[0] };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * 학원 일정 삭제
 */
async function deleteEvent(eventId, academyId) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.query(
            'SELECT * FROM academy_events WHERE id = ? AND academy_id = ?',
            [eventId, academyId]
        );

        if (existing.length === 0) {
            return { status: 404, message: '일정을 찾을 수 없습니다.' };
        }

        await removeEventBlocks(connection, eventId);
        await connection.execute('DELETE FROM academy_events WHERE id = ?', [eventId]);

        await connection.commit();
        return { status: 200, message: '학원 일정이 삭제되었습니다.' };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { getEvents, getEventById, createEvent, updateEvent, deleteEvent };
