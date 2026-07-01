const db = require('../../config/database');
const { verifyToken, requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { paidAmountSql, remainingAmountSql, dueUnpaidSql } = require('../../utils/paymentAmountSql');

function registerDashboardReport(router) {
    router.get('/dashboard', verifyToken, requireRole('owner', 'admin', 'staff'), async (req, res) => {
        try {
            const academyId = req.user.academyId;
            const currentMonth = new Date().toISOString().slice(0, 7);

            const [studentStats] = await db.query(
                `SELECT
                    COUNT(*) as total_students,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_students,
                    SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused_students,
                    SUM(CASE WHEN status = 'withdrawn' THEN 1 ELSE 0 END) as withdrawn_students
                FROM students
                WHERE academy_id = ? AND deleted_at IS NULL AND (is_trial = 0 OR is_trial IS NULL)`,
                [academyId]
            );

            const today = new Date().toISOString().split('T')[0];
            const [restEndedStats] = await db.query(
                `SELECT COUNT(*) as count
                 FROM students
                 WHERE academy_id = ?
                 AND deleted_at IS NULL
                 AND status = 'paused'
                 AND rest_end_date IS NOT NULL
                 AND rest_end_date < ?`,
                [academyId, today]
            );

            const [instructorStats] = await db.query(
                `SELECT
                    COUNT(*) as total_instructors,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_instructors
                FROM instructors
                WHERE academy_id = ?`,
                [academyId]
            );

            const [paymentRevenue] = await db.query(
                `SELECT
                    COUNT(*) as count,
                    COALESCE(SUM(${paidAmountSql('p')}), 0) as amount
                FROM student_payments p
                WHERE p.academy_id = ?
                AND p.payment_status = 'paid'
                AND DATE_FORMAT(p.paid_date, '%Y-%m') = ?`,
                [academyId, currentMonth]
            );

            const [otherIncome] = await db.query(
                `SELECT
                    COUNT(*) as count,
                    COALESCE(SUM(amount), 0) as amount
                FROM other_incomes
                WHERE academy_id = ?
                AND DATE_FORMAT(income_date, '%Y-%m') = ?`,
                [academyId, currentMonth]
            );

            const totalRevenueCount = parseInt(paymentRevenue[0].count) + parseInt(otherIncome[0].count);
            const totalRevenueAmount = parseFloat(paymentRevenue[0].amount) + parseFloat(otherIncome[0].amount);

            const [expenseStats] = await db.query(
                `SELECT
                    COUNT(*) as count,
                    COALESCE(SUM(amount), 0) as amount
                FROM expenses
                WHERE academy_id = ?
                AND DATE_FORMAT(expense_date, '%Y-%m') = ?`,
                [academyId, currentMonth]
            );

            const totalExpenseCount = parseInt(expenseStats[0].count);
            const totalExpenseAmount = parseFloat(expenseStats[0].amount);
            const remainingExpr = remainingAmountSql('p');

            const [unpaidStats] = await db.query(
                `SELECT
                    COUNT(*) as unpaid_count,
                    COALESCE(SUM(${remainingExpr}), 0) as unpaid_amount
                FROM student_payments p
                WHERE p.academy_id = ?
                AND p.payment_status IN ('pending', 'partial', 'overdue')
                AND ${dueUnpaidSql('p')}
                AND ${remainingExpr} > 0`,
                [academyId]
            );

            res.json({
                students: studentStats[0],
                instructors: instructorStats[0],
                current_month: {
                    month: currentMonth,
                    revenue: {
                        count: totalRevenueCount,
                        amount: totalRevenueAmount
                    },
                    expenses: {
                        count: totalExpenseCount,
                        amount: totalExpenseAmount
                    },
                    net_income: totalRevenueAmount - totalExpenseAmount
                },
                unpaid_payments: {
                    count: unpaidStats[0].unpaid_count,
                    amount: parseFloat(unpaidStats[0].unpaid_amount)
                },
                rest_ended_students: {
                    count: restEndedStats[0].count
                }
            });
        } catch (error) {
            logger.error('Error fetching dashboard:', error);
            res.status(500).json({
                error: 'Server Error',
                message: 'Failed to fetch dashboard data'
            });
        }
    });
}

module.exports = registerDashboardReport;
