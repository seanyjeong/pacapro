/**
 * 결제 금액 SQL 조각.
 *
 * paid_amount가 비어 있는 과거 완납 데이터는 final_amount를 수납액으로 보정한다.
 */

function paidAmountSql(alias = 'p') {
    return `CASE
        WHEN ${alias}.payment_status = 'paid' AND COALESCE(${alias}.paid_amount, 0) = 0
            THEN COALESCE(${alias}.final_amount, 0)
        ELSE COALESCE(${alias}.paid_amount, 0)
    END`;
}

function remainingAmountSql(alias = 'p') {
    return `GREATEST(COALESCE(${alias}.final_amount, 0) - (${paidAmountSql(alias)}), 0)`;
}

function dueUnpaidSql(alias = 'p') {
    return `NOT (${alias}.payment_type = 'season' AND ${alias}.due_date > CURDATE())`;
}

// 미납 알림: 시즌비는 시즌 시작일로부터 5일이 지난 날(한국 날짜)부터 보낸다.
// 시즌을 찾지 못하는 시즌비는 보내지 않는다.
function seasonNoticeReadySql(alias = 'p') {
    return `NOT (${alias}.payment_type = 'season' AND NOT EXISTS (
        SELECT 1 FROM seasons notice_season
        WHERE notice_season.id = ${alias}.season_id
        AND DATE_ADD(notice_season.season_start_date, INTERVAL 5 DAY) <= DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00'))
    ))`;
}

module.exports = {
    paidAmountSql,
    remainingAmountSql,
    dueUnpaidSql,
    seasonNoticeReadySql,
};
