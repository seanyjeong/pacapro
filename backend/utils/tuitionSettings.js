/**
 * 학원비 설정 정규화 유틸.
 * 온보딩은 과거에 "1" 키를, 설정 화면은 weekly_1 키를 사용해 둘을 통일한다.
 */

const WEEKLY_KEYS = [1, 2, 3, 4, 5, 6, 7];

function toAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
}

function normalizeWeeklyTuition(source) {
    const input = source && typeof source === 'object' ? source : {};
    return WEEKLY_KEYS.reduce((result, count) => {
        const weeklyKey = `weekly_${count}`;
        result[weeklyKey] = toAmount(input[weeklyKey] ?? input[String(count)] ?? 0);
        return result;
    }, {});
}

function normalizeSeasonFees(source) {
    const input = source && typeof source === 'object' ? source : {};
    return {
        exam_early: toAmount(input.exam_early ?? 0),
        exam_regular: toAmount(input.exam_regular ?? 0),
        civil_service: toAmount(input.civil_service ?? 0)
    };
}

function normalizeTuitionSettings(settings) {
    const input = settings && typeof settings === 'object' ? settings : {};
    return {
        exam_tuition: normalizeWeeklyTuition(input.exam_tuition),
        adult_tuition: normalizeWeeklyTuition(input.adult_tuition),
        season_fees: normalizeSeasonFees(input.season_fees)
    };
}

// 반 학원비 표(classes.tuition_by_weekly). NULL·빈 값이면 null = 학원 기본표를 쓴다.
function parseClassTuition(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? normalizeWeeklyTuition(parsed) : null;
}

/**
 * 학생에게 쓸 주N회 학원비 표: 학생 반의 표 → 없으면 학원 표.
 * 입시/성인 구분은 학원 표에만 있다(반 표는 하나). 학원 표는 저장된 모양 그대로 돌려줘
 * 반 표가 없을 때 결과가 지금과 글자까지 같다.
 */
function resolveTuitionTable(academySettings, studentType, classTuition) {
    const classTable = parseClassTuition(classTuition);
    if (classTable) return classTable;
    const settings = academySettings || {};
    return (studentType === 'adult' ? settings.adult_tuition : settings.exam_tuition) || null;
}

// 표에서 주N회 금액. 없거나 0이면 null(학원비를 바꾸지 않는다) — 기존 수업일 변경과 같은 규칙.
function weeklyTuitionAmount(tuitionTable, weeklyCount) {
    if (!tuitionTable || !(weeklyCount > 0)) return null;
    return tuitionTable[`weekly_${weeklyCount}`] || null;
}

module.exports = {
    normalizeSeasonFees,
    normalizeTuitionSettings,
    normalizeWeeklyTuition,
    parseClassTuition,
    resolveTuitionTable,
    weeklyTuitionAmount
};
