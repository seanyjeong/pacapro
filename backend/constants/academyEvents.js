const DEFAULT_COLORS = {
    work: '#f59e0b',
    academy: '#3b82f6',
    holiday: '#ef4444',
    etc: '#6b7280'
};

const TIME_SLOTS = ['morning', 'afternoon', 'evening'];
const MORNING_END_HOUR = 12;
const AFTERNOON_END_HOUR = 18;
const EVENT_FIELDS = ['title', 'description', 'event_type', 'event_date', 'start_time', 'end_time', 'is_all_day', 'is_holiday', 'color'];

module.exports = { DEFAULT_COLORS, TIME_SLOTS, MORNING_END_HOUR, AFTERNOON_END_HOUR, EVENT_FIELDS };
