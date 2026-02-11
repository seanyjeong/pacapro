const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkPermission } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * GET /paca/academy-events
 * 월별 학원 일정 조회
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { start_date, end_date, event_type } = req.query;

        let query = `
            SELECT
                ae.*,
                u.name AS created_by_name
            FROM academy_events ae
            LEFT JOIN users u ON ae.created_by = u.id
            WHERE ae.academy_id = ?
        `;
        const params = [req.user.academyId];

        if (start_date) {
            query += ' AND ae.event_date >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND ae.event_date <= ?';
            params.push(end_date);
        }

        if (event_type) {
            query += ' AND ae.event_type = ?';
            params.push(event_type);
        }

        query += ' ORDER BY ae.event_date ASC, ae.start_time ASC';

        const [events] = await db.query(query, params);
        res.json({ events });
    } catch (error) {
        logger.error('Error fetching academy events:', error);
        res.status(500).json({ message: '학원 일정 조회 실패', error: error.message });
    }
});

/**
 * GET /paca/academy-events/:id
 * 특정 일정 조회
 */
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [events] = await db.query(
            'SELECT * FROM academy_events WHERE id = ? AND academy_id = ?',
            [req.params.id, req.user.academyId]
        );

        if (events.length === 0) {
            return res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
        }

        res.json({ event: events[0] });
    } catch (error) {
        logger.error('Error fetching academy event:', error);
        res.status(500).json({ message: '학원 일정 조회 실패', error: error.message });
    }
});

/**
 * POST /paca/academy-events
 * 학원 일정 생성
 */
router.post('/', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            title,
            description,
            event_type = 'academy',
            event_date,
            start_time,
            end_time,
            is_all_day = true,
            is_holiday = false,
            color
        } = req.body;

        if (!title || !event_date) {
            return res.status(400).json({ message: '제목과 날짜는 필수입니다.' });
        }

        // 디버깅 로그
        console.log('=== ACADEMY EVENT DEBUG ===');
        console.log('academyId:', req.user.academyId);
        console.log('userId:', req.user.id);
        console.log('title:', title);
        console.log('event_date:', event_date);
        console.log('event_type:', event_type);
        console.log('is_all_day:', is_all_day);
        console.log('is_holiday:', is_holiday);
        console.log('color:', color);
        console.log('===========================');

        // 일정 타입별 기본 색상
        const defaultColors = {
            work: '#f59e0b',
            academy: '#3b82f6',
            holiday: '#ef4444',
            etc: '#6b7280'
        };

        const finalColor = color || defaultColors[event_type] || '#3b82f6';

        // 일정 생성
        const [result] = await connection.execute(
            `INSERT INTO academy_events
             (academy_id, title, description, event_type, event_date, start_time, end_time, is_all_day, is_holiday, color, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.academyId,
                title,
                description || null,
                event_type || 'academy',
                event_date,
                start_time || null,
                end_time || null,
                is_all_day === undefined ? true : Boolean(is_all_day),
                is_holiday === undefined ? false : Boolean(is_holiday),
                finalColor,
                req.user.id
            ]
        );

        const eventId = result.insertId;

        // 상담 차단 적용 (휴일이면 전체 + 수업 휴강, 일반 일정이면 해당 시간대만)
        if (is_holiday) {
            await applyHolidayBlocks(connection, req.user.academyId, event_date, eventId, title);
        } else {
            // 일반 일정도 해당 시간대 상담 차단
            await applyEventBlocks(connection, req.user.academyId, event_date, eventId, title, is_all_day, start_time, end_time);
        }

        await connection.commit();

        const [newEvent] = await db.query('SELECT * FROM academy_events WHERE id = ?', [eventId]);
        res.status(201).json({ message: '학원 일정이 등록되었습니다.', event: newEvent[0] });
    } catch (error) {
        await connection.rollback();
        logger.error('Error creating academy event:', error);
        res.status(500).json({ message: '학원 일정 등록 실패', error: error.message });
    } finally {
        connection.release();
    }
});

/**
 * PUT /paca/academy-events/:id
 * 학원 일정 수정
 */
router.put('/:id', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const eventId = req.params.id;

        // 기존 일정 조회
        const [existing] = await connection.query(
            'SELECT * FROM academy_events WHERE id = ? AND academy_id = ?',
            [eventId, req.user.academyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
        }

        const oldEvent = existing[0];
        const {
            title,
            description,
            event_type,
            event_date,
            start_time,
            end_time,
            is_all_day,
            is_holiday,
            color
        } = req.body;

        // 일정 업데이트
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
                title,
                description,
                event_type,
                event_date,
                start_time !== undefined ? start_time : oldEvent.start_time,
                end_time !== undefined ? end_time : oldEvent.end_time,
                is_all_day,
                is_holiday,
                color,
                eventId
            ]
        );

        // 휴일 상태 변경 처리
        const newIsHoliday = is_holiday !== undefined ? is_holiday : oldEvent.is_holiday;
        const newEventDate = event_date || oldEvent.event_date;
        const newTitle = title || oldEvent.title;

        // 기존에 휴일이었는데 해제된 경우 -> 차단/휴강 복구
        if (oldEvent.is_holiday && !newIsHoliday) {
            await removeHolidayBlocks(connection, eventId);
        }
        // 새로 휴일로 지정된 경우 -> 차단/휴강 적용
        else if (!oldEvent.is_holiday && newIsHoliday) {
            await applyHolidayBlocks(connection, req.user.academyId, newEventDate, eventId, newTitle);
        }
        // 휴일 유지인데 날짜가 변경된 경우 -> 기존 해제 후 새로 적용
        else if (oldEvent.is_holiday && newIsHoliday && oldEvent.event_date !== newEventDate) {
            await removeHolidayBlocks(connection, eventId);
            await applyHolidayBlocks(connection, req.user.academyId, newEventDate, eventId, newTitle);
        }

        await connection.commit();

        const [updatedEvent] = await db.query('SELECT * FROM academy_events WHERE id = ?', [eventId]);
        res.json({ message: '학원 일정이 수정되었습니다.', event: updatedEvent[0] });
    } catch (error) {
        await connection.rollback();
        logger.error('Error updating academy event:', error);
        res.status(500).json({ message: '학원 일정 수정 실패', error: error.message });
    } finally {
        connection.release();
    }
});

/**
 * DELETE /paca/academy-events/:id
 * 학원 일정 삭제
 */
router.delete('/:id', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const eventId = req.params.id;

        // 기존 일정 조회
        const [existing] = await connection.query(
            'SELECT * FROM academy_events WHERE id = ? AND academy_id = ?',
            [eventId, req.user.academyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
        }

        const oldEvent = existing[0];

        // 일정에 연결된 상담 차단 해제 (휴일/일반 일정 모두)
        await removeEventBlocks(connection, eventId);

        // 일정 삭제
        await connection.execute('DELETE FROM academy_events WHERE id = ?', [eventId]);

        await connection.commit();
        res.json({ message: '학원 일정이 삭제되었습니다.' });
    } catch (error) {
        await connection.rollback();
        logger.error('Error deleting academy event:', error);
        res.status(500).json({ message: '학원 일정 삭제 실패', error: error.message });
    } finally {
        connection.release();
    }
});

/**
 * 휴일 지정 시 상담 차단 + 수업 휴강 처리
 */
async function applyHolidayBlocks(connection, academyId, eventDate, eventId, title) {
    // 1. 상담 차단 슬롯 추가 (오전/오후/저녁 전부)
    const timeSlots = ['morning', 'afternoon', 'evening'];
    for (const slot of timeSlots) {
        await connection.execute(
            `INSERT INTO consultation_blocked_slots (academy_id, blocked_date, time_slot, reason, blocked_by, academy_event_id)
             VALUES (?, ?, ?, ?, 'system', ?)
             ON DUPLICATE KEY UPDATE reason = VALUES(reason), academy_event_id = VALUES(academy_event_id)`,
            [academyId, eventDate, slot, `휴일: ${title}`, eventId]
        );
    }

    // 2. 해당 날짜의 모든 수업 휴강 처리
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
    // 1. 해당 이벤트로 추가된 상담 차단 슬롯 삭제
    await connection.execute(
        'DELETE FROM consultation_blocked_slots WHERE academy_event_id = ?',
        [eventId]
    );

    // 2. 해당 이벤트로 휴강 처리된 수업 복구
    await connection.execute(
        `UPDATE class_schedules
         SET is_closed = FALSE, close_reason = NULL, academy_event_id = NULL
         WHERE academy_event_id = ?`,
        [eventId]
    );
}

/**
 * 시간을 시간대(time_slot)로 변환
 * isEndTime: true면 종료 시간으로 처리 (경계값은 이전 시간대로)
 */
function getTimeSlotFromTime(timeStr, isEndTime = false) {
    if (!timeStr) return null;
    const [hourStr, minStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const min = parseInt(minStr || '0', 10);

    // 종료 시간이고 정각인 경우, 해당 시간대 시작 경계면 이전 시간대로
    if (isEndTime && min === 0) {
        if (hour === 12) return 'morning';   // 12:00까지 → 오전만
        if (hour === 18) return 'afternoon'; // 18:00까지 → 오후까지
    }

    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}

/**
 * 일반 일정 시 해당 시간대 상담 차단
 */
async function applyEventBlocks(connection, academyId, eventDate, eventId, title, isAllDay, startTime, endTime) {
    let slotsToBlock = [];

    if (isAllDay) {
        // 종일 일정: 모든 시간대 차단
        slotsToBlock = ['morning', 'afternoon', 'evening'];
    } else if (startTime) {
        // 시간 지정 일정: 해당 시간대만 차단
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

    // 상담 차단 슬롯 추가
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
    // 해당 이벤트로 추가된 상담 차단 슬롯 삭제
    await connection.execute(
        'DELETE FROM consultation_blocked_slots WHERE academy_event_id = ?',
        [eventId]
    );

    // 휴일 관련 수업 휴강도 복구
    await connection.execute(
        `UPDATE class_schedules
         SET is_closed = FALSE, close_reason = NULL, academy_event_id = NULL
         WHERE academy_event_id = ?`,
        [eventId]
    );
}

module.exports = router;
