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

module.exports = {
    paidAmountSql,
    remainingAmountSql,
    dueUnpaidSql,
};
