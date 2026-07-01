const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkPermission } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

require('./reportParts/dashboard')(router);

/**
 * GET /paca/reports/financial/monthly
 * Get monthly financial report (revenue, expenses, net income)
 * Access: owner, admin
 */
router.get('/financial/monthly', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
    try {
        const { year, month } = req.query;

        if (!year || !month) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'year and month are required'
            });
        }

        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const academyId = req.user.academyId;

        // Get revenue breakdown
        const [revenues] = await db.query(
            `SELECT
                category,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM revenues
            WHERE academy_id = ?
            AND DATE_FORMAT(revenue_date, '%Y-%m') = ?
            GROUP BY category
            ORDER BY total_amount DESC`,
            [academyId, yearMonth]
        );

        // Get total revenue
        const [revenueTotal] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total_revenue
            FROM revenues
            WHERE academy_id = ?
            AND DATE_FORMAT(revenue_date, '%Y-%m') = ?`,
            [academyId, yearMonth]
        );

        // Get expense breakdown
        const [expenses] = await db.query(
            `SELECT
                category,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM expenses
            WHERE academy_id = ?
            AND DATE_FORMAT(expense_date, '%Y-%m') = ?
            GROUP BY category
            ORDER BY total_amount DESC`,
            [academyId, yearMonth]
        );

        // Get total expenses
        const [expenseTotal] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses
            WHERE academy_id = ?
            AND DATE_FORMAT(expense_date, '%Y-%m') = ?`,
            [academyId, yearMonth]
        );

        const totalRevenue = parseFloat(revenueTotal[0].total_revenue);
        const totalExpenses = parseFloat(expenseTotal[0].total_expenses);
        const netIncome = totalRevenue - totalExpenses;

        res.json({
            year_month: yearMonth,
            revenue: {
                total: totalRevenue,
                breakdown: revenues.map(r => ({
                    category: r.category,
                    count: r.count,
                    amount: parseFloat(r.total_amount)
                }))
            },
            expenses: {
                total: totalExpenses,
                breakdown: expenses.map(e => ({
                    category: e.category,
                    count: e.count,
                    amount: parseFloat(e.total_amount)
                }))
            },
            net_income: netIncome
        });
    } catch (error) {
        logger.error('Error fetching monthly financial report:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch monthly financial report'
        });
    }
});

/**
 * GET /paca/reports/financial/yearly
 * Get yearly financial trend (monthly breakdown)
 * Access: owner, admin
 */
router.get('/financial/yearly', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
    try {
        const { year } = req.query;

        if (!year) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'year is required'
            });
        }

        const academyId = req.user.academyId;

        // Get monthly revenue trend
        const [revenues] = await db.query(
            `SELECT
                DATE_FORMAT(revenue_date, '%Y-%m') as month,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM revenues
            WHERE academy_id = ?
            AND YEAR(revenue_date) = ?
            GROUP BY DATE_FORMAT(revenue_date, '%Y-%m')
            ORDER BY month`,
            [academyId, year]
        );

        // Get monthly expense trend
        const [expenses] = await db.query(
            `SELECT
                DATE_FORMAT(expense_date, '%Y-%m') as month,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM expenses
            WHERE academy_id = ?
            AND YEAR(expense_date) = ?
            GROUP BY DATE_FORMAT(expense_date, '%Y-%m')
            ORDER BY month`,
            [academyId, year]
        );

        // Combine data by month
        const monthlyData = {};

        revenues.forEach(r => {
            monthlyData[r.month] = {
                month: r.month,
                revenue: parseFloat(r.total_amount),
                expenses: 0,
                net_income: 0
            };
        });

        expenses.forEach(e => {
            if (!monthlyData[e.month]) {
                monthlyData[e.month] = {
                    month: e.month,
                    revenue: 0,
                    expenses: 0,
                    net_income: 0
                };
            }
            monthlyData[e.month].expenses = parseFloat(e.total_amount);
        });

        // Calculate net income for each month
        Object.values(monthlyData).forEach(data => {
            data.net_income = data.revenue - data.expenses;
        });

        const trend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

        // Calculate yearly totals
        const yearlyTotal = trend.reduce((acc, month) => ({
            revenue: acc.revenue + month.revenue,
            expenses: acc.expenses + month.expenses,
            net_income: acc.net_income + month.net_income
        }), { revenue: 0, expenses: 0, net_income: 0 });

        res.json({
            year,
            monthly_trend: trend,
            yearly_total: yearlyTotal
        });
    } catch (error) {
        logger.error('Error fetching yearly financial trend:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch yearly financial trend'
        });
    }
});

/**
 * GET /paca/reports/students
 * Get student statistics
 * Access: owner, admin
 */
router.get('/students', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
    try {
        const academyId = req.user.academyId;

        // Get overall statistics
        const [overall] = await db.query(
            `SELECT
                COUNT(*) as total_students,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
                SUM(CASE WHEN status = 'graduated' THEN 1 ELSE 0 END) as graduated,
                SUM(CASE WHEN status = 'withdrawn' THEN 1 ELSE 0 END) as withdrawn
            FROM students
            WHERE academy_id = ? AND deleted_at IS NULL`,
            [academyId]
        );

        // Get breakdown by grade
        const [byGrade] = await db.query(
            `SELECT
                grade,
                grade_type,
                COUNT(*) as count
            FROM students
            WHERE academy_id = ?
            AND deleted_at IS NULL
            AND status IN ('active', 'paused')
            GROUP BY grade, grade_type
            ORDER BY grade, grade_type`,
            [academyId]
        );

        // Get breakdown by admission type
        const [byAdmission] = await db.query(
            `SELECT
                admission_type,
                COUNT(*) as count
            FROM students
            WHERE academy_id = ?
            AND deleted_at IS NULL
            AND status IN ('active', 'paused')
            GROUP BY admission_type`,
            [academyId]
        );

        res.json({
            overall: overall[0],
            by_grade: byGrade,
            by_admission_type: byAdmission
        });
    } catch (error) {
        logger.error('Error fetching student statistics:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch student statistics'
        });
    }
});

/**
 * GET /paca/reports/instructors
 * Get instructor statistics
 * Access: owner, admin
 */
router.get('/instructors', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
    try {
        const academyId = req.user.academyId;

        // Get overall statistics
        const [overall] = await db.query(
            `SELECT
                COUNT(*) as total_instructors,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) as on_leave,
                SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END) as retired
            FROM instructors
            WHERE academy_id = ?`,
            [academyId]
        );

        // Get breakdown by salary type
        const [bySalaryType] = await db.query(
            `SELECT
                salary_type,
                COUNT(*) as count
            FROM instructors
            WHERE academy_id = ?
            AND status = 'active'
            GROUP BY salary_type`,
            [academyId]
        );

        // Get breakdown by tax type
        const [byTaxType] = await db.query(
            `SELECT
                tax_type,
                COUNT(*) as count
            FROM instructors
            WHERE academy_id = ?
            AND status = 'active'
            GROUP BY tax_type`,
            [academyId]
        );

        res.json({
            overall: overall[0],
            by_salary_type: bySalaryType,
            by_tax_type: byTaxType
        });
    } catch (error) {
        logger.error('Error fetching instructor statistics:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch instructor statistics'
        });
    }
});

/**
 * GET /paca/reports/attendance
 * Get attendance statistics
 * Access: owner, admin
 */
router.get('/attendance', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const academyId = req.user.academyId;

        if (!start_date || !end_date) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'start_date and end_date are required'
            });
        }

        // Get attendance statistics
        const [stats] = await db.query(
            `SELECT
                COUNT(*) as total_records,
                SUM(CASE WHEN a.attendance_status = 'present' THEN 1 ELSE 0 END) as present_count,
                SUM(CASE WHEN a.attendance_status = 'absent' THEN 1 ELSE 0 END) as absent_count,
                SUM(CASE WHEN a.attendance_status = 'late' THEN 1 ELSE 0 END) as late_count,
                SUM(CASE WHEN a.attendance_status = 'excused' THEN 1 ELSE 0 END) as excused_count
            FROM attendance a
            JOIN class_schedules cs ON a.class_schedule_id = cs.id
            JOIN students s ON a.student_id = s.id
            WHERE s.academy_id = ?
            AND cs.class_date BETWEEN ? AND ?`,
            [academyId, start_date, end_date]
        );

        const totalRecords = stats[0].total_records;
        const presentCount = stats[0].present_count;
        const attendanceRate = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(2) : 0;

        // Get student-wise attendance
        const [byStudent] = await db.query(
            `SELECT
                s.id as student_id,
                s.name as student_name,
                s.student_number,
                COUNT(*) as total_days,
                SUM(CASE WHEN a.attendance_status = 'present' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN a.attendance_status = 'absent' THEN 1 ELSE 0 END) as absent_days,
                SUM(CASE WHEN a.attendance_status = 'late' THEN 1 ELSE 0 END) as late_days
            FROM students s
            LEFT JOIN attendance a ON s.id = a.student_id
            LEFT JOIN class_schedules cs ON a.class_schedule_id = cs.id
                AND cs.class_date BETWEEN ? AND ?
            WHERE s.academy_id = ?
            AND s.deleted_at IS NULL
            AND s.status = 'active'
            GROUP BY s.id, s.name, s.student_number
            HAVING total_days > 0
            ORDER BY s.name`,
            [start_date, end_date, academyId]
        );

        // Calculate attendance rate for each student (학생 이름 복호화 포함)
        const studentStats = byStudent.map(student => ({
            student_id: student.student_id,
            student_name: decrypt(student.student_name),
            student_number: student.student_number,
            total_days: student.total_days,
            present_days: student.present_days,
            absent_days: student.absent_days,
            late_days: student.late_days,
            attendance_rate: student.total_days > 0
                ? ((student.present_days / student.total_days) * 100).toFixed(2)
                : 0
        }));

        res.json({
            period: {
                start_date,
                end_date
            },
            overall: {
                total_records: totalRecords,
                present_count: presentCount,
                absent_count: stats[0].absent_count,
                late_count: stats[0].late_count,
                excused_count: stats[0].excused_count,
                attendance_rate: parseFloat(attendanceRate)
            },
            by_student: studentStats
        });
    } catch (error) {
        logger.error('Error fetching attendance statistics:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch attendance statistics'
        });
    }
});

require('./reportParts/paymentsUnpaid')(router);

module.exports = router;
