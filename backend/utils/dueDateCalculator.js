/**
 * 납부기한 계산 유틸리티
 * 납부일 이후 학생의 첫 출석일을 납부기한으로 설정
 */

/**
 * 납부기한 계산
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @param {number} dueDay - 납부일 (1-31)
 * @param {number[]} classDays - 출석요일 배열 [0=일, 1=월, ..., 6=토]
 * @returns {string} YYYY-MM-DD 형식의 납부기한
 */
function calculateDueDate(year, month, dueDay, classDays) {
    // 해당 월의 마지막 날 계산
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const actualDueDay = Math.min(dueDay, lastDayOfMonth);

    // 출석일 정보 없으면 납부일 그대로 사용
    if (!classDays || !Array.isArray(classDays) || classDays.length === 0) {
        return formatDate(year, month, actualDueDay);
    }

    // 납부일부터 7일간 확인하여 첫 출석일 찾기
    for (let offset = 0; offset <= 7; offset++) {
        const checkDate = new Date(year, month - 1, actualDueDay + offset);
        const dayOfWeek = checkDate.getDay();

        if (classDays.includes(dayOfWeek)) {
            return formatDate(
                checkDate.getFullYear(),
                checkDate.getMonth() + 1,
                checkDate.getDate()
            );
        }
    }

    // 7일 내 출석일 없으면 납부일 그대로 반환
    return formatDate(year, month, actualDueDay);
}

/**
 * 날짜를 YYYY-MM-DD 형식 문자열로 변환
 */
function formatDate(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

module.exports = { calculateDueDate };
