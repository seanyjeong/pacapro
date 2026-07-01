const { pool } = require('./_utils');
const { DEFAULT_SEASON_MONTHLY_POLICY } = require('../../utils/seasonMonthlyPolicy');

async function deleteUnpaidMonthlyPaymentsForSeason(studentId, academyId, season) {
    const policy = season.season_monthly_policy || DEFAULT_SEASON_MONTHLY_POLICY;
    if (policy !== DEFAULT_SEASON_MONTHLY_POLICY) {
        return { deleted: 0, skipped: true };
    }

    const startMonth = String(season.season_start_date).slice(0, 7);
    const endMonth = String(season.season_end_date).slice(0, 7);
    if (startMonth.length !== 7 || endMonth.length !== 7) {
        return { deleted: 0, skipped: true };
    }

    const [result] = await pool.execute(
        `DELETE FROM student_payments
         WHERE student_id = ?
         AND academy_id = ?
         AND payment_type = 'monthly'
         AND \`year_month\` BETWEEN ? AND ?
         AND payment_status IN ('pending', 'overdue', 'unpaid')
         AND COALESCE(paid_amount, 0) = 0`,
        [studentId, academyId, startMonth, endMonth]
    );

    return { deleted: result.affectedRows || 0, skipped: false };
}

module.exports = {
    deleteUnpaidMonthlyPaymentsForSeason,
};
