const { seasonMonthlyExclusionSql, seasonMonthlyExclusionParams } = require('./seasonMonthlyExclusion');

async function canCreateMonthlyPayment(connection, student, yearMonth) {
    const [rows] = await connection.execute(
        `SELECT ${seasonMonthlyExclusionSql('s')} AS allowed
         FROM students s WHERE s.id = ? AND s.academy_id = ?`,
        [...seasonMonthlyExclusionParams(yearMonth), student.id, student.academy_id]
    );
    return Boolean(rows[0]?.allowed);
}

async function findMonthlyPayments(connection, student, yearMonth) {
    const [rows] = await connection.execute(
        `SELECT id, base_amount, discount_amount, additional_amount, carryover_amount,
                final_amount, paid_amount, payment_status
         FROM student_payments
         WHERE student_id = ? AND academy_id = ? AND \`year_month\` = ?
           AND payment_type = 'monthly' FOR UPDATE`,
        [student.id, student.academy_id, yearMonth]
    );
    return rows;
}

async function insertPayment(connection, student, payment, recordedBy) {
    const [result] = await connection.execute(
        `INSERT INTO student_payments (
            student_id, academy_id, \`year_month\`, payment_type,
            base_amount, discount_amount, additional_amount, final_amount,
            is_prorated, due_date, payment_status, description, notes, recorded_by
        ) VALUES (?, ?, ?, 'monthly', ?, ?, 0, ?, 1, ?, 'pending', ?, ?, ?)`,
        [student.id, student.academy_id, payment.yearMonth, payment.baseAmount,
            payment.discountAmount, payment.finalAmount, payment.dueDate,
            payment.description, payment.notes, recordedBy]
    );
    return result.insertId;
}

async function adjustPayment(connection, student, payment, finalAmount, resumeDate) {
    // Preserve paid money and credit applications; only restore the shortened bill.
    await connection.execute(
        `UPDATE student_payments SET final_amount = ?, is_prorated = 1,
            payment_status = CASE WHEN paid_amount >= ? THEN 'paid'
                WHEN paid_amount > 0 THEN 'partial'
                WHEN due_date < ? THEN 'overdue' ELSE 'pending' END,
            notes = CONCAT_WS('\n', NULLIF(notes, ''), ?), updated_at = NOW()
         WHERE id = ? AND student_id = ? AND academy_id = ?`,
        [finalAmount, finalAmount, resumeDate,
            `[휴원 복귀] ${resumeDate}: ${payment.final_amount}원 → ${finalAmount}원`,
            payment.id, student.id, student.academy_id]
    );
}

module.exports = { canCreateMonthlyPayment, findMonthlyPayments, insertPayment, adjustPayment };
