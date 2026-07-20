/**
 * routes/students/firstPayment.js
 *
 * 첫 달 일할계산 학원비 수동 재계산 (POST /paca/students/:id/recalculate-first-payment)
 *
 * ## 용도
 * - 등록일/수강료/수업요일이 바뀐 뒤 첫 달 일할 금액이 어긋난 경우 버튼 한 번으로 복구.
 * - 현재 등록일(enrollment_date) 기준으로 create.js / crud/update.js 와 동일한 일할 공식 적용
 *   (실수업일 기준, 수업요일 미설정 시 일수 기준, 천원 단위 절삭).
 *
 * ## 인증
 * - verifyToken + checkPermission('students', 'edit') — owner / admin.
 *
 * ## 동작 규칙
 * - 등록월의 미납(pending) 월 학원비 중 일할계산 건(is_prorated=1 OR description LIKE '%일할계산%')만 대상.
 * - 납부완료 건은 거부 (결제 내역에서 직접 수정 안내).
 * - 등록월에 일할계산 건이 없으면 404 (다른 월로 옮겨간 건 자동으로 끌어오지 않음 — 복귀 일할 오인 방지).
 * - 재계산된 일할 청구의 납부기한은 등록일로 통일.
 *
 * ## 응답
 * - 200: {message, payment: {id, year_month, base_amount, discount_amount, final_amount, due_date}}
 * - 400/404: {error, message} (한국어, ADR-003)
 * - 5xx: {error: 'Server Error', message} (한국어, ADR-003)
 */

const pool = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { resolveProratedPaymentDueDate } = require('../../utils/proratedPaymentDueDate');
const { parseClassDaysWithSlots, extractDayNumbers, truncateToThousands } = require('./_utils');

module.exports = function(router) {

/**
 * POST /paca/students/:id/recalculate-first-payment
 * Recalculate first month prorated payment based on current enrollment_date
 * Access: owner, admin
 */
router.post('/:id/recalculate-first-payment', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        const [students] = await pool.execute(
            `SELECT id, enrollment_date, monthly_tuition, discount_rate, class_days, time_slot
             FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: '학생 정보를 찾을 수 없습니다.' });
        }

        const student = students[0];

        if (!student.enrollment_date) {
            return res.status(400).json({ error: 'Bad Request', message: '등록일이 설정되지 않은 학생입니다.' });
        }

        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        if (baseAmount <= 0) {
            return res.status(400).json({ error: 'Bad Request', message: '월 수강료가 설정되지 않은 학생입니다.' });
        }

        const enrollYearMonth = String(student.enrollment_date).slice(0, 7);

        const [proratedRows] = await pool.execute(
            `SELECT id, payment_status FROM student_payments
             WHERE student_id = ? AND academy_id = ?
               AND \`year_month\` = ? AND payment_type = 'monthly'
               AND (is_prorated = 1 OR description LIKE '%일할계산%')`,
            [studentId, req.user.academyId, enrollYearMonth]
        );

        if (proratedRows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: `등록월(${enrollYearMonth})의 미납 일할계산 학원비를 찾을 수 없습니다.`
            });
        }

        const proratedPayment = proratedRows[0];

        if (proratedPayment.payment_status !== 'pending') {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이미 납부된 학원비는 재계산할 수 없습니다. 결제 내역에서 직접 수정해주세요.'
            });
        }

        // create.js / crud/update.js 일할계산과 동일 로직
        const enrollDate = new Date(String(student.enrollment_date));
        const year = enrollDate.getFullYear();
        const month = enrollDate.getMonth() + 1;
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        const enrollDay = enrollDate.getDate();
        const remainingDays = lastDayOfMonth - enrollDay + 1;

        const classDaysRaw = student.class_days
            ? (typeof student.class_days === 'string' ? JSON.parse(student.class_days) : student.class_days)
            : [];
        const parsedClassDays = extractDayNumbers(parseClassDaysWithSlots(classDaysRaw, student.time_slot || 'evening'));

        let classDaysCount = 0;
        for (let d = enrollDay; d <= lastDayOfMonth; d++) {
            if (parsedClassDays.includes(new Date(year, month - 1, d).getDay())) classDaysCount++;
        }
        let totalClassDaysInMonth = 0;
        for (let d = 1; d <= lastDayOfMonth; d++) {
            if (parsedClassDays.includes(new Date(year, month - 1, d).getDay())) totalClassDaysInMonth++;
        }

        let proRatedAmount;
        if (totalClassDaysInMonth > 0 && classDaysCount > 0) {
            proRatedAmount = truncateToThousands(baseAmount / totalClassDaysInMonth * classDaysCount);
        } else {
            // 수업요일 설정 없으면 일수 기준
            proRatedAmount = truncateToThousands(baseAmount * remainingDays / lastDayOfMonth);
        }
        const discountRateNum = parseFloat(student.discount_rate) || 0;
        const discountAmount = truncateToThousands(proRatedAmount * discountRateNum / 100);
        const finalAmount = proRatedAmount - discountAmount;

        const dueDateStr = resolveProratedPaymentDueDate(String(student.enrollment_date));

        await pool.execute(
            `UPDATE student_payments
             SET base_amount = ?, discount_amount = ?, final_amount = ?,
                 is_prorated = 1, proration_details = ?,
                 due_date = ?, description = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                proRatedAmount, discountAmount, finalAmount,
                JSON.stringify({ enrollDay, remainingDays, totalDays: lastDayOfMonth, classCountInPeriod: classDaysCount, totalClassDaysInMonth }),
                dueDateStr, `${month}월 학원비 (${enrollDay}일 등록, 일할계산)`,
                proratedPayment.id
            ]
        );

        logger.info(`[Student ${studentId}] First payment recalculated via button: ${finalAmount}원 (enrollment ${student.enrollment_date})`);

        res.json({
            message: `첫 달 학원비 재계산 완료: ${finalAmount.toLocaleString()}원 (${enrollDay}일 등록 기준)`,
            payment: {
                id: proratedPayment.id,
                year_month: enrollYearMonth,
                base_amount: proRatedAmount,
                discount_amount: discountAmount,
                final_amount: finalAmount,
                due_date: dueDateStr
            }
        });
    } catch (error) {
        logger.error('First payment recalc failed:', error);
        res.status(500).json({ error: 'Server Error', message: '첫 달 학원비 재계산에 실패했습니다.' });
    }
});

};
