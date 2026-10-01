const ACTIONS = new Set(['graduate', 'regular']);

function isDateText(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateSeasonAftercare({ seasonEndDate, freeLessonEndDate, postFreeAction }, { required = false } = {}) {
    if (freeLessonEndDate === null && postFreeAction === null) {
        return required ? '무료 수업 종료일과 종료 후 처리를 지정해주세요.' : null;
    }
    if (!isDateText(seasonEndDate)) return '시즌 종료일을 확인해주세요.';
    if (!isDateText(freeLessonEndDate)) return '무료 수업 종료일을 입력해주세요.';
    if (freeLessonEndDate < seasonEndDate) return '무료 수업 종료일은 시즌 종료일보다 빠를 수 없습니다.';
    if (!ACTIONS.has(postFreeAction)) return '무료 수업 종료 후 처리를 선택해주세요.';
    return null;
}

module.exports = { isDateText, validateSeasonAftercare };
