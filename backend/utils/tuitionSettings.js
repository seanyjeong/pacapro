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

module.exports = {
    normalizeSeasonFees,
    normalizeTuitionSettings,
    normalizeWeeklyTuition
};
