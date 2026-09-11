const repository = require('../repositories/academyEventRepository');
const { DEFAULT_COLORS, TIME_SLOTS, MORNING_END_HOUR, AFTERNOON_END_HOUR } = require('../constants/academyEvents');

function slotIndex(time, isEnd = false) {
    const [hour, minute] = time.split(':').map(Number);
    if (isEnd && minute === 0) {
        if (hour === MORNING_END_HOUR) return 0;
        if (hour === AFTERNOON_END_HOUR) return 1;
    }
    if (hour < MORNING_END_HOUR) return 0;
    return hour < AFTERNOON_END_HOUR ? 1 : 2;
}

function consultationSlots(event) {
    if (!event.block_consultation) return [];
    if (event.is_all_day || event.is_holiday) return TIME_SLOTS;
    return TIME_SLOTS.slice(slotIndex(event.start_time), slotIndex(event.end_time, true) + 1);
}

function normalizeEvent(body, existing = {}) {
    const event = { ...existing };
    for (const field of ['title', 'description', 'event_type', 'event_date', 'start_time', 'end_time', 'color']) {
        if (body[field] !== undefined) event[field] = body[field];
    }
    for (const field of ['is_all_day', 'is_holiday', 'block_consultation']) {
        if (body[field] !== undefined && ![true, false, 0, 1].includes(body[field])) {
            return { error: '일정의 선택 항목을 다시 확인해주세요.' };
        }
        event[field] = Boolean(body[field] ?? existing[field] ?? (field === 'is_all_day'));
    }
    if (typeof event.title !== 'string' || !event.title.trim() || !event.event_date) {
        return { error: '제목과 날짜는 필수입니다.' };
    }
    event.event_type ||= 'academy';
    event.color ||= DEFAULT_COLORS[event.event_type] || DEFAULT_COLORS.academy;
    if (event.block_consultation && !event.is_all_day && !event.is_holiday) {
        const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
        if (!validTime(event.start_time) || !validTime(event.end_time) || event.start_time.slice(0, 5) >= event.end_time.slice(0, 5)) {
            return { error: '상담을 차단할 시작 시간과 종료 시간을 확인해주세요.' };
        }
    }
    return { event };
}

async function addConsultationBlocks(connection, eventId, academyId, event) {
    for (const slot of consultationSlots(event)) {
        await repository.addConsultationBlock(connection, eventId, academyId, event, slot);
    }
}

async function getEvents(academyId, filters) {
    return { events: await repository.findEvents(academyId, filters) };
}

async function getEventById(eventId, academyId) {
    return repository.findEvent(eventId, academyId);
}

async function createEvent(academyId, userId, body) {
    const { event, error } = normalizeEvent(body);
    if (error) return { status: 400, message: error };
    return repository.withTransaction(async connection => {
        const eventId = await repository.insertEvent(connection, academyId, userId, event);
        await addConsultationBlocks(connection, eventId, academyId, event);
        if (event.is_holiday) await repository.closeClasses(connection, eventId, academyId, event);
        return {
            status: 201, message: '학원 일정이 등록되었습니다.',
            event: await repository.findEvent(eventId, academyId, connection)
        };
    });
}

async function updateEvent(eventId, academyId, body) {
    return repository.withTransaction(async connection => {
        const oldEvent = await repository.findEvent(eventId, academyId, connection, true);
        if (!oldEvent) return { status: 404, message: '일정을 찾을 수 없습니다.' };
        const { event, error } = normalizeEvent(body, oldEvent);
        if (error) return { status: 400, message: error };

        await repository.updateEvent(connection, eventId, academyId, event);
        const blockChanged = ['block_consultation', 'event_date', 'title', 'start_time', 'end_time']
            .some(field => event[field] !== oldEvent[field]) ||
            ['is_all_day', 'is_holiday'].some(field => event[field] !== Boolean(oldEvent[field]));
        if (blockChanged) {
            await repository.removeConsultationBlocks(connection, eventId, academyId);
            await addConsultationBlocks(connection, eventId, academyId, event);
        }
        const holidayChanged = Boolean(oldEvent.is_holiday) !== event.is_holiday ||
            oldEvent.event_date !== event.event_date || oldEvent.title !== event.title;
        if (holidayChanged) {
            if (oldEvent.is_holiday) await repository.reopenClasses(connection, eventId, academyId);
            if (event.is_holiday) await repository.closeClasses(connection, eventId, academyId, event);
        }
        return {
            status: 200, message: '학원 일정이 수정되었습니다.',
            event: await repository.findEvent(eventId, academyId, connection)
        };
    });
}

async function deleteEvent(eventId, academyId) {
    return repository.withTransaction(async connection => {
        const event = await repository.findEvent(eventId, academyId, connection, true);
        if (!event) return { status: 404, message: '일정을 찾을 수 없습니다.' };
        await repository.removeConsultationBlocks(connection, eventId, academyId);
        await repository.reopenClasses(connection, eventId, academyId);
        await repository.deleteEvent(connection, eventId, academyId);
        return { status: 200, message: '학원 일정이 삭제되었습니다.' };
    });
}

module.exports = { getEvents, getEventById, createEvent, updateEvent, deleteEvent, consultationSlots };
