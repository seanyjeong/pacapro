const SEASON_PAYMENT_SUMMARY_JOIN = `
            LEFT JOIN (
                SELECT
                    p.student_id,
                    p.academy_id,
                    COALESCE(p.season_id, payment_season.id) as resolved_season_id,
                    SUM(COALESCE(p.paid_amount, 0)) as payment_paid_amount,
                    MAX(COALESCE(p.final_amount, 0)) as payment_final_amount,
                    CASE
                        WHEN SUM(CASE WHEN p.payment_status = 'paid' THEN 1 ELSE 0 END) > 0 THEN 'paid'
                        WHEN SUM(CASE WHEN p.payment_status = 'partial' THEN 1 ELSE 0 END) > 0 THEN 'partial'
                        ELSE MAX(p.payment_status)
                    END as payment_record_status
                FROM student_payments p
                LEFT JOIN seasons payment_season
                    ON p.season_id IS NULL
                    AND payment_season.academy_id = p.academy_id
                    AND p.description LIKE CONCAT('%', payment_season.season_name, '%')
                WHERE p.payment_type = 'season'
                GROUP BY p.student_id, p.academy_id, COALESCE(p.season_id, payment_season.id)
            ) sp ON sp.student_id = ss.student_id
                AND sp.academy_id = s.academy_id
                AND sp.resolved_season_id = ss.season_id`;

function toAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
}

function firstAmount(...values) {
    for (const value of values) {
        const amount = toAmount(value);
        if (amount !== null) return amount;
    }
    return 0;
}

function getSeasonPaymentSummary(enrollment) {
    const finalAmount = firstAmount(
        enrollment.payment_final_amount,
        enrollment.final_fee,
        enrollment.season_fee
    );
    const statusSource = enrollment.payment_record_status || enrollment.payment_status || 'pending';
    let paidAmount = firstAmount(enrollment.payment_paid_amount, enrollment.paid_amount);

    if (statusSource === 'paid' && paidAmount === 0 && finalAmount > 0) {
        paidAmount = finalAmount;
    }

    let paymentStatus = statusSource;
    if (enrollment.payment_status === 'cancelled') {
        paymentStatus = 'cancelled';
    } else if (paidAmount > 0 && finalAmount > 0 && paidAmount >= finalAmount) {
        paymentStatus = 'paid';
    } else if (paidAmount > 0) {
        paymentStatus = 'partial';
    } else if (!paymentStatus) {
        paymentStatus = 'pending';
    }

    return {
        final_fee: finalAmount,
        paid_amount: paidAmount,
        remaining_amount: Math.max(finalAmount - paidAmount, 0),
        payment_status: paymentStatus,
    };
}

function applySeasonPaymentSummary(enrollment) {
    const summary = getSeasonPaymentSummary(enrollment);
    enrollment.final_fee = summary.final_fee;
    enrollment.paid_amount = summary.paid_amount;
    enrollment.remaining_amount = summary.remaining_amount;
    enrollment.payment_status = summary.payment_status;
    delete enrollment.payment_paid_amount;
    delete enrollment.payment_final_amount;
    delete enrollment.payment_record_status;
    return enrollment;
}

module.exports = {
    SEASON_PAYMENT_SUMMARY_JOIN,
    applySeasonPaymentSummary,
    getSeasonPaymentSummary,
};
