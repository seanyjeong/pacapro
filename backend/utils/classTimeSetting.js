const CLASS_TIME_PATTERN = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
const NO_CLASS_TIME = '-';

const CLASS_TIME_LABELS = {
    morning_class_time: '오전',
    afternoon_class_time: '오후',
    evening_class_time: '저녁',
};

function isValidClassTimeSetting(value) {
    return value === NO_CLASS_TIME || CLASS_TIME_PATTERN.test(value);
}

function getClassTimeValidationMessage(field) {
    const label = CLASS_TIME_LABELS[field] || '수업';
    return `${label} 수업시간을 다시 선택해주세요. 수업이 없으면 "수업 없음"을 선택할 수 있습니다.`;
}

module.exports = {
    getClassTimeValidationMessage,
    isValidClassTimeSetting,
};
