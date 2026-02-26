/**
 * 학번 자동 생성 유틸리티
 * 형식: {년도}{3자리 순번} (예: 2026001, 2026002, ...)
 */

/**
 * 다음 학번 생성
 * @param {string|null} lastStudentNumber - 해당 학원의 마지막 학번 (예: "2026005")
 * @param {number} [year] - 연도 (기본: 현재 연도)
 * @returns {string} 생성된 학번 (예: "2026006")
 */
function generateStudentNumber(lastStudentNumber, year) {
    const targetYear = year || new Date().getFullYear();

    if (!lastStudentNumber) {
        return `${targetYear}001`;
    }

    const lastNum = parseInt(lastStudentNumber.slice(-3));
    if (isNaN(lastNum)) {
        return `${targetYear}001`;
    }

    return `${targetYear}${String(lastNum + 1).padStart(3, '0')}`;
}

module.exports = { generateStudentNumber };
