const db = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const { remainingAmountSql, dueUnpaidSql } = require('../../utils/paymentAmountSql');

function registerPaymentsUnpaidReport(router) {
    router.get('/payments/unpaid', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
        try {
            const academyId = req.user.academyId;
            const remainingExpr = remainingAmountSql('p');
            const dueExpr = dueUnpaidSql('p');

            const [stats] = await db.query(
                `SELECT
                    p.payment_status,
                    COUNT(*) as count,
                    SUM(${remainingExpr}) as total_amount
                FROM student_payments p
                WHERE p.academy_id = ?
                AND p.payment_status IN ('pending', 'partial', 'overdue')
                AND ${dueExpr}
                AND ${remainingExpr} > 0
                GROUP BY p.payment_status`,
                [academyId]
            );

            const [byStudent] = await db.query(
                `SELECT
                    s.id as student_id,
                    s.name as student_name,
                    s.student_number,
                    s.phone,
                    s.parent_phone,
                    COUNT(*) as unpaid_count,
                    SUM(${remainingExpr}) as unpaid_amount
                FROM student_payments p
                JOIN students s ON p.student_id = s.id
                WHERE p.academy_id = ?
                AND p.payment_status IN ('pending', 'partial', 'overdue')
                AND ${dueExpr}
                AND ${remainingExpr} > 0
                GROUP BY s.id, s.name, s.student_number, s.phone, s.parent_phone
                ORDER BY unpaid_amount DESC`,
                [academyId]
            );

            const totalUnpaid = stats.reduce((sum, stat) => sum + parseFloat(stat.total_amount || 0), 0);

            res.json({
                summary: {
                    total_unpaid_amount: totalUnpaid,
                    by_status: stats.map(s => ({
                        status: s.payment_status,
                        count: s.count,
                        amount: parseFloat(s.total_amount || 0)
                    }))
                },
                by_student: byStudent.map(s => ({
                    student_id: s.student_id,
                    student_name: decrypt(s.student_name),
                    student_number: s.student_number,
                    phone: decrypt(s.phone),
                    parent_phone: decrypt(s.parent_phone),
                    unpaid_count: s.unpaid_count,
                    unpaid_amount: parseFloat(s.unpaid_amount || 0)
                }))
            });
        } catch (error) {
            logger.error('Error fetching unpaid payment report:', error);
            res.status(500).json({
                error: 'Server Error',
                message: 'Failed to fetch unpaid payment report'
            });
        }
    });
}

module.exports = registerPaymentsUnpaidReport;
