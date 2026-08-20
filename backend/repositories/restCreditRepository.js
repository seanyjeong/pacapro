async function findCurrentRestCreditsForUpdate(connection, {
    academyId,
    restStartDate,
    studentId,
}) {
    const [rows] = await connection.execute(
        `SELECT id, rest_start_date, rest_end_date, rest_days,
                credit_amount, remaining_amount, credit_type, status
         FROM rest_credits
         WHERE student_id = ?
           AND academy_id = ?
           AND rest_start_date = ?
           AND credit_type IN ('carryover', 'refund')
           AND COALESCE(status, 'pending') <> 'cancelled'
         ORDER BY id
         FOR UPDATE`,
        [studentId, academyId, restStartDate]
    );

    return rows;
}

async function updateRecalculatedCredit(connection, {
    academyId,
    creditAmount,
    creditId,
    note,
    remainingAmount,
    restDays,
    restEndDate,
    status,
    studentId,
}) {
    const [result] = await connection.execute(
        `UPDATE rest_credits SET
            rest_end_date = ?,
            rest_days = ?,
            credit_amount = ?,
            remaining_amount = ?,
            status = ?,
            notes = CONCAT_WS('\n', NULLIF(notes, ''), ?)
         WHERE id = ? AND student_id = ? AND academy_id = ?`,
        [
            restEndDate,
            restDays,
            creditAmount,
            remainingAmount,
            status,
            note,
            creditId,
            studentId,
            academyId,
        ]
    );

    if (result.affectedRows !== 1) {
        throw new Error('Rest credit recalculation update did not affect exactly one row.');
    }
}

module.exports = {
    findCurrentRestCreditsForUpdate,
    updateRecalculatedCredit,
};
