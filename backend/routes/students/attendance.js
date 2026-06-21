const db = require('../../config/database');
const { verifyToken } = require('../../middleware/auth');
const logger = require('../../utils/logger');

module.exports = function(router) {

/**
 * GET /paca/students/:id/attendance
 * Get student monthly attendance records
 * Query: year_month (YYYY-MM)
 */
router.get('/:id/attendance', verifyToken, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { year_month } = req.query;
        const academyId = req.user.academyId;

        if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'year_month is required (YYYY-MM format)'
            });
        }

        const [year, month] = year_month.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        // Verify student belongs to this academy + get enrollment_date
        const [studentCheck] = await db.query(
            'SELECT id, enrollment_date FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, academyId]
        );
        if (studentCheck.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        // Filter out pre-enrollment records
        const enrollmentDate = studentCheck[0].enrollment_date;
        const enrollDateStr = enrollmentDate ? new Date(enrollmentDate).toISOString().split('T')[0] : null;
        const effectiveStartDate = enrollDateStr && enrollDateStr > startDate ? enrollDateStr : startDate;

        // Get daily attendance records
        const [records] = await db.query(
            `SELECT
                cs.class_date as date,
                cs.time_slot,
                a.attendance_status,
                a.is_makeup,
                a.notes
            FROM attendance a
            JOIN class_schedules cs ON a.class_schedule_id = cs.id
            WHERE a.student_id = ?
              AND cs.class_date >= ?
              AND cs.class_date <= ?
              AND cs.academy_id = ?
            ORDER BY cs.class_date, FIELD(cs.time_slot, 'morning', 'afternoon', 'evening')`,
            [studentId, effectiveStartDate, endDate, academyId]
        );

        // Calculate summary
        const summary = {
            total: records.length,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            makeup: 0
        };

        records.forEach(r => {
            if (r.attendance_status === 'present') summary.present++;
            else if (r.attendance_status === 'absent') summary.absent++;
            else if (r.attendance_status === 'late') summary.late++;
            else if (r.attendance_status === 'excused') summary.excused++;
            if (r.is_makeup) summary.makeup++;
        });

        summary.attendance_rate = summary.total > 0
            ? parseFloat(((summary.present / summary.total) * 100).toFixed(1))
            : 0;

        // Format dates
        const formattedRecords = records.map(r => ({
            date: r.date instanceof Date
                ? r.date.toISOString().split('T')[0]
                : String(r.date).split('T')[0],
            time_slot: r.time_slot,
            attendance_status: r.attendance_status,
            is_makeup: r.is_makeup ? true : false,
            notes: r.notes || null
        }));

        res.json({
            student_id: studentId,
            year_month,
            summary,
            records: formattedRecords
        });

    } catch (error) {
        logger.error('Error fetching student attendance:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch student attendance'
        });
    }
});

};
