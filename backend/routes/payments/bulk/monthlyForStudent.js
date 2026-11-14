const { pool, logger } = require('../_utils');
const { verifyToken, checkPermission } = require('../../../middleware/auth');
const { seasonMonthlyExclusionSql, seasonMonthlyExclusionParams } = require('../../../repositories/seasonMonthlyExclusion');
const { monthlyBillAmounts } = require('../../../utils/monthlyBillAmounts');
const { deductMonthlyCredit } = require('../../../services/monthlyCreditDeduction');
const { nonSeasonProratedCandidates, planNonSeasonProrated, insertNonSeasonProrated } = require('../../../services/nonSeasonProratedBilling');

// 만든 청구와 학생 이름
async function createdPayment(paymentId) {
    const [created] = await pool.execute(
        `SELECT p.*, s.name as student_name
        FROM student_payments p
        JOIN students s ON p.student_id = s.id
        WHERE p.id = ?`,
        [paymentId]
    );
    return created[0];
}

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
            // 시즌으로 이 달 월회비가 빠지는 학생: 매달 자동·일괄 청구처럼 비시즌 종강 일할 청구 대상이면 그것을 만든다
            const [candidate] = await nonSeasonProratedCandidates(pool, req.user.academyId, yearMonth, Number(student_id));
            if (candidate) {
                const plan = planNonSeasonProrated(candidate, yearMonth);
                const paymentId = await insertNonSeasonProrated(pool, req.user.academyId, candidate, plan, req.user.userId);
                return res.status(201).json({
                    message: '비시즌 종강 일할 납부건이 생성되었습니다.',
                    payment: await createdPayment(paymentId),
                    nonSeasonProrated: {
                        amount: plan.amount, seasonName: candidate.season_name, nonSeasonEndDate: candidate.non_season_end_date,
                        description: plan.description,
                    }
                });
            }
            return res.status(409).json({
                error: 'Season Aftercare',
                message: '시즌 무료 수업 또는 자동 졸업 대상 기간에는 월 납부건을 생성할 수 없습니다.'
            });
        }

        // Check existing
        const [existing] = await pool.execute(
            `SELECT id FROM student_payments
            WHERE student_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'`,
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
        // 월 청구 금액 공통 함수(소수 오차 없는 할인액 천원 절삭)
        const discountAmount = monthlyBillAmounts(baseAmount, discountRate).discount;

        // 비시즌 종강 일할은 월회비에 붙이지 않고 시즌 시작 달에 따로 청구한다(위 비시즌 처리, 매달 자동·일괄 청구와 같음)
        const additionalAmount = 0;
        let notes = null;
        let description = `${year}년 ${month}월 학원비`;

        // 휴식 이월·공결·수동 크레딧 차감(일괄 청구와 같은 함수)
        let carryoverAmount = 0;
        let restCreditId = null;
        try {
            ({ carryoverAmount, restCreditId } = await deductMonthlyCredit(pool, {
                studentId: student.id, academyId: req.user.academyId,
                amountBeforeCarryover: baseAmount - discountAmount + additionalAmount,
            }));
            if (restCreditId) {
                notes = `[이월 차감] 휴식 크레딧 ${carryoverAmount.toLocaleString()}원 차감`;
                description += ' (이월 차감 적용)';
            }
        } catch (err) {
            logger.error(`Failed to apply carryover credit for student ${student_id}:`, err);
        }

        const finalAmount = monthlyBillAmounts(baseAmount, discountRate, additionalAmount, carryoverAmount).final;

        // Due date
        const dueDate = new Date(year, month - 1, dueDay);

        const [result] = await pool.execute(
            `INSERT INTO student_payments (
                student_id, academy_id, \`year_month\`, payment_type,
                base_amount, discount_amount, additional_amount, carryover_amount, rest_credit_id, final_amount,
                due_date, payment_status, description, notes, recorded_by
            ) VALUES (?, ?, ?, 'monthly', ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
            [
                student_id,
                req.user.academyId,
                yearMonth,
                baseAmount,
                discountAmount,
                additionalAmount,
                carryoverAmount,
                restCreditId,
                finalAmount,
                dueDate.toISOString().split('T')[0],
                description,
                notes,
                req.user.userId
            ]
        );

        res.status(201).json({
            message: '월 납부건이 생성되었습니다.',
            payment: await createdPayment(result.insertId),
            nonSeasonProrated: null
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
