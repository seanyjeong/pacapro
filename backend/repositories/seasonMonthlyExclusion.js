function seasonMonthlyExclusionSql(studentAlias = 's') {
    if (!['s'].includes(studentAlias)) throw new TypeError('Invalid student alias');
    return `NOT EXISTS (
        SELECT 1 FROM student_seasons ss
        JOIN seasons se ON se.id = ss.season_id
        WHERE ss.student_id = ${studentAlias}.id
          AND se.academy_id = ${studentAlias}.academy_id
          AND COALESCE(ss.is_cancelled, 0) = 0
          AND ss.payment_status != 'cancelled'
          AND se.season_start_date <= LAST_DAY(STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d'))
          AND (
              (se.status IN ('upcoming', 'active')
               AND se.season_end_date >= STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d')
               AND COALESCE(se.season_monthly_policy, 'season_replaces_monthly') = 'season_replaces_monthly')
              OR ((
                  (se.free_lesson_end_date IS NOT NULL
                   AND se.season_end_date < STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d')
                   AND se.free_lesson_end_date >= STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d'))
                  OR (se.post_free_action = 'graduate'
                      AND se.free_lesson_end_date < STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d')
                      AND ss.aftercare_applied_at IS NULL
                      AND (${studentAlias}.current_season_id IS NULL OR ${studentAlias}.current_season_id = se.id))
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM student_seasons later
                      JOIN seasons next_se ON next_se.id = later.season_id
                      WHERE later.student_id = ${studentAlias}.id
                        AND next_se.academy_id = ${studentAlias}.academy_id
                        AND next_se.id != se.id
                        AND next_se.season_start_date > se.season_start_date
                        AND next_se.season_start_date <= LAST_DAY(STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d'))
                        AND next_se.season_end_date >= STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d')
                        AND COALESCE(later.is_cancelled, 0) = 0
                        AND later.payment_status != 'cancelled'
                  ))
          )
    )`;
}

function seasonMonthlyExclusionParams(yearMonth) {
    return Array(7).fill(yearMonth);
}

module.exports = { seasonMonthlyExclusionSql, seasonMonthlyExclusionParams };
