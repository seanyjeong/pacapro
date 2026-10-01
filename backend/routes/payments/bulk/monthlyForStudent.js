const { pool, truncateToThousands, calculateNonSeasonEndProrated, logger } = require('../_utils');
const { verifyToken, checkPermission } = require('../../../middleware/auth');
const { seasonMonthlyExclusionSql, seasonMonthlyExclusionParams } = require('../../../repositories/seasonMonthlyExclusion');

module.exports = function registerMonthlyForStudent(router) {
/**
 * POST /paca/payments/generate-monthly-for-student
 * Generate next month's payment for a specific student
 * Access: owner, admin
 */
router.post('/generate-monthly-for-student', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    try {
        const { student_id, year, month } = req.body;

        if (!student_id || !year || !month) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '필수 항목을 모두 입력해주세요. (학생, 연도, 월)'
            });
        }

        // Get student info
        const [students] = await pool.execute(
            `SELECT
                s.id, s.name, s.monthly_tuition, s.discount_rate,
                s.payment_due_day,
                a.tuition_due_day
            FROM students s
            JOIN academies ac ON s.academy_id = ac.id
            LEFT JOIN academy_settings a ON ac.id = a.academy_id
            WHERE s.id = ? AND s.academy_id = ? AND s.status = 'active' AND s.deleted_at IS NULL`,
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생을 찾을 수 없습니다.'
            });
        }

        const student = students[0];
        const dueDay = student.payment_due_day || student.tuition_due_day || 5;
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const [eligibility] = await pool.execute(
            `SELECT ${seasonMonthlyExclusionSql('s')} AS allowed
             FROM students s WHERE s.id = ? AND s.academy_id = ?`,
            [...seasonMonthlyExclusionParams(yearMonth), student_id, req.user.academyId]
        );
        if (!eligibility[0]?.allowed) {
            return res.status(409).json({
                error: 'Season Aftercare',
                message: '시즌 무료 수업 또는 자동 졸업 대상 기간에는 월 납부건을 생성할 수 없습니다.'
            });
        }

        // Check existing
        const [existing] = await pool.execute(
            `SELECT id FROM student_payments
            WHERE student_id = ? AND year_month = ? AND payment_type = 'monthly'`,
            [student_id, yearMonth]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: `${yearMonth} 월 납부건이 이미 존재합니다.`
            });
        }

        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const discountRate = parseFloat(student.discount_rate) || 0;
        const discountAmount = truncateToThousands(baseAmount * (discountRate / 100));

        // 비시즌 종강 일할 계산
        let additionalAmount = 0;
        let notes = null;
        let description = `${year}년 ${month}월 학원비`;
        let nonSeasonProratedInfo = null;

        try {
            const nonSeasonProrated = await calculateNonSeasonEndProrated({
                studentId: student_id,
                academyId: req.user.academyId,
                year,
                month
            });

            if (nonSeasonProrated) {
                additionalAmount = nonSeasonProrated.amount;
                notes = `[비시즌 종강 일할] ${nonSeasonProrated.description}\n${nonSeasonProrated.details.formula}`;
                description = `${year}년 ${month}월 학원비 + 비시즌 종강 일할`;
                nonSeasonProratedInfo = nonSeasonProrated;
            }
        } catch (err) {
            logger.error(`Failed to calculate non-season prorated for student ${student_id}:`, err);
        }

        const finalAmount = truncateToThousands(baseAmount - discountAmount + additionalAmount);

        // Due date
        const dueDate = new Date(year, month - 1, dueDay);

        const [result] = await pool.execute(
            `INSERT INTO student_payments (
                student_id, academy_id, year_month, payment_type,
                base_amount, discount_amount, additional_amount, final_amount,
                due_date, payment_status, description, notes, recorded_by
            ) VALUES (?, ?, ?, 'monthly', ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
            [
                student_id,
                req.user.academyId,
                yearMonth,
                baseAmount,
                discountAmount,
                additionalAmount,
                finalAmount,
                dueDate.toISOString().split('T')[0],
                description,
                notes,
                req.user.userId
            ]
        );

        const [created] = await pool.execute(
            `SELECT p.*, s.name as student_name
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            message: nonSeasonProratedInfo
                ? '월 납부건이 생성되었습니다. (비시즌 종강 일할 포함)'
                : '월 납부건이 생성되었습니다.',
            payment: created[0],
            nonSeasonProrated: nonSeasonProratedInfo
        });
    } catch (error) {
        logger.error('Error generating monthly payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '월 납부건 생성에 실패했습니다.'
        });
    }
});

};
