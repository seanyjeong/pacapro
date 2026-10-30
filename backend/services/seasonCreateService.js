/**
 * 시즌 생성 — 화면(POST /paca/seasons)과 AI 연결(season_create)이 같은 검사·같은 행을 쓴다.
 * routes/seasons/crud.js 에서 옮겨 왔고 동작은 그대로다. 트랜잭션은 호출한 쪽이 연다.
 */

const {
    DEFAULT_SEASON_MONTHLY_POLICY,
    isSeasonMonthlyPolicy,
} = require('../utils/seasonMonthlyPolicy');
const { validateSeasonAftercare } = require('./seasonAftercarePolicy');

// 거절 문구(화면 400 message) 또는 null
function validateSeasonCreate(input) {
    const {
        season_name,
        season_type,
        season_start_date,
        season_end_date,
        free_lesson_end_date,
        post_free_action,
        non_season_end_date,
        operating_days,
        season_monthly_policy
    } = input;

    if (!season_name || !season_type || !season_start_date || !season_end_date || !non_season_end_date || !operating_days) {
        return 'Required fields: season_name, season_type, season_start_date, season_end_date, non_season_end_date, operating_days';
    }

    if (!['early', 'regular'].includes(season_type)) {
        return 'season_type must be early or regular';
    }

    if (!(season_monthly_policy === undefined || isSeasonMonthlyPolicy(season_monthly_policy))) {
        return '월납부 처리 방식을 확인해주세요.';
    }

    const nonSeasonEnd = new Date(non_season_end_date);
    const seasonStart = new Date(season_start_date);
    const seasonEnd = new Date(season_end_date);

    if (nonSeasonEnd >= seasonStart) {
        return 'non_season_end_date must be before season_start_date';
    }

    if (seasonStart >= seasonEnd) {
        return 'season_start_date must be before season_end_date';
    }

    return validateSeasonAftercare({
        seasonEndDate: season_end_date,
        freeLessonEndDate: free_lesson_end_date || null,
        postFreeAction: post_free_action || null,
    }, { required: true });
}

async function insertSeason(conn, academyId, input) {
    const [result] = await conn.execute(
        `INSERT INTO seasons (
            academy_id,
            season_name,
            season_type,
            season_start_date,
            season_end_date,
            free_lesson_end_date,
            post_free_action,
            non_season_end_date,
            operating_days,
            grade_time_slots,
            default_season_fee,
            payment_due_date,
            season_monthly_policy,
            allows_continuous,
            continuous_to_season_type,
            continuous_discount_type,
            continuous_discount_rate,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming')`,
        [
            academyId,
            input.season_name,
            input.season_type,
            input.season_start_date,
            input.season_end_date,
            input.free_lesson_end_date || null,
            input.post_free_action || null,
            input.non_season_end_date,
            JSON.stringify(input.operating_days),
            input.grade_time_slots ? JSON.stringify(input.grade_time_slots) : null,
            input.default_season_fee || 0,
            input.payment_due_date || null,
            input.season_monthly_policy || DEFAULT_SEASON_MONTHLY_POLICY,
            input.allows_continuous || false,
            input.continuous_to_season_type || null,
            input.continuous_discount_type || 'none',
            input.continuous_discount_rate || 0
        ]
    );
    return result.insertId;
}

module.exports = { validateSeasonCreate, insertSeason };
