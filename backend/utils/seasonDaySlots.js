/**
 * 시즌 요일별 운영 시간대(seasons.operating_day_slots).
 * 모양: {"1": ["morning","afternoon","evening"], "2": ["morning","afternoon"]} — 키는 요일(0=일 ~ 6=토).
 * NULL 이거나 그 요일 키가 없으면 그 요일은 모든 시간대를 운영한다(지금과 같음).
 * 수업 일정(출석부)만 이 값을 따른다. 일할계산·환불은 지금처럼 운영 요일(operating_days)로 센다.
 */

const TIME_SLOTS = ['morning', 'afternoon', 'evening'];

function parseOperatingDaySlots(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
}

// 저장 전 검사. 거절 문구 또는 null
function validateOperatingDaySlots(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object' || Array.isArray(value)) return '요일별 운영 시간대 값이 올바르지 않습니다.';
    for (const [day, slots] of Object.entries(value)) {
        if (!/^[0-6]$/.test(day)) return '요일별 운영 시간대 값이 올바르지 않습니다.';
        if (!Array.isArray(slots) || slots.length === 0 || !slots.every(slot => TIME_SLOTS.includes(slot))) {
            return '운영하는 요일마다 시간대를 하나 이상 골라주세요.';
        }
    }
    return null;
}

// 그 요일에 학생이 들을 시간대 = 학생 시간대 중 그 요일에 운영하는 것
function slotsForDay(daySlots, dayOfWeek, studentSlots) {
    const operating = daySlots && daySlots[String(dayOfWeek)];
    if (!Array.isArray(operating)) return studentSlots;
    return studentSlots.filter(slot => operating.includes(slot));
}

module.exports = {
    parseOperatingDaySlots,
    validateOperatingDaySlots,
    slotsForDay
};
