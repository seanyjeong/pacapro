/**
 * paca/payments/prepaid.js — 선납 할인 결제 라우터 (Phase 3 #6)
 *
 * 마운트: paca.js → routes/payments/index.js → require('./prepaid')(router)
 *         mount path: '/paca/payments'
 *
 * Endpoint (2건 — 모두 정적 경로):
 *   - POST /prepaid-preview — 선납 결제 미리보기 (금액 계산, DB 변경 X)
 *   - POST /prepaid-pay     — 선납 결제 실행 (트랜잭션 — student_payments INSERT/UPDATE + revenues INSERT)
 *
 * 인증: verifyToken (학원 관리자 직접 호출 — checkPermission 없음, 원본 보존)
 *
 * 응답 표면 보존 (ADR-013):
 *   POST /prepaid-preview → { student_name, monthly_tuition, student_discount_rate, prepaid_discount_rate, months, total_final, total_prepaid_discount, months_payable, months_already_paid }
 *   POST /prepaid-pay     → { message, prepaid_group_id, total_amount, total_discount, months_processed, months_skipped }
 *   4xx                   → { error, message }
 *   5xx                   → { error:'Server Error', message:'...' }
 *
 * DB 호출 (ADR-005):
 *   - prepaid-preview: pool.execute (학생 + 월별 existing N건)
 *   - prepaid-pay: conn.execute (트랜잭션 — student SELECT + 월별 SELECT FOR UPDATE + INSERT/UPDATE + revenues INSERT)
 *
 * **트랜잭션 패턴 보존 (lesson #217)**:
 *   - dry_run 분기 X (preview 는 별도 endpoint)
 *   - SELECT FOR UPDATE 로 동시성 보호
 *   - 정상: conn.commit() + release / 에러: conn.rollback() + release
 *   - validation 실패 시 connection.release() 만 (트랜잭션 시작 전)
 *
 * ADR-007: decrypt 시그니처 무변경 (preview 응답에서 학생 이름 복호화).
 *
 * **결제 데이터 영속 변경 X (사장님 결정 2026-05-02)**:
 *   - student_payments INSERT/UPDATE 컬럼/순서/값 1:1 보존
 *   - prepaid_group_id (crypto.randomUUID) 발급 패턴 보존
 *   - notes (`[선납 N개월] X% 할인 (Y원)`) 포맷 보존
 *   - revenues INSERT (선납 결제) 1:1 보존
 *
 * 분리 결정 (ADR-006): ~290줄 — 분리 불요.
 */

const { pool, decrypt, truncateToThousands, logger } = require('./_utils');
const { verifyToken } = require('../../middleware/auth');
const crypto = require('crypto');

module.exports = function(router) {

/**
 * POST /paca/payments/prepaid-preview
 * 선납 미리보기 (금액 계산, DB 변경 X)
 */
router.post('/prepaid-preview', verifyToken, async (req, res) => {
    try {
        const { student_id, months, prepaid_discount_rate } = req.body;

        // Validation
        if (!student_id || !Array.isArray(months) || months.length < 2 || months.length > 6) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '학생 ID와 2~6개월 범위의 월 목록이 필요합니다.'
            });
        }

        const rate = parseFloat(prepaid_discount_rate);
        if (isNaN(rate) || rate < 0 || rate > 50) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '선납 할인율은 0~50% 범위여야 합니다.'
            });
        }

        // 학생 조회
        const [students] = await pool.execute(
            `SELECT s.id, s.name, s.monthly_tuition, s.discount_rate, s.payment_due_day, s.status,
                    a.tuition_due_day
             FROM students s
             LEFT JOIN academy_settings a ON s.academy_id = a.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: '학생을 찾을 수 없습니다.' });
        }

        const student = students[0];
        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const studentDiscountRate = parseFloat(student.discount_rate) || 0;

        // 각 월별 계산
        const monthDetails = [];
        let totalFinal = 0;
        let totalPrepaidDiscount = 0;
        let monthsPayable = 0;
        let monthsAlreadyPaid = 0;

        for (const yearMonth of months) {
            // 기존 결제 레코드 확인
            const [existing] = await pool.execute(
                'SELECT id, payment_status, paid_amount, final_amount FROM student_payments WHERE student_id = ? AND `year_month` = ? AND payment_type = ?',
                [student_id, yearMonth, 'monthly']
            );

            let status = 'new';
            if (existing.length > 0) {
                const ex = existing[0];
                if (ex.payment_status === 'paid') {
                    status = 'already_paid';
                } else {
                    status = 'existing_unpaid';
                }
            }

            const studentDiscount = truncateToThousands(baseAmount * studentDiscountRate / 100);
            const afterStudentDiscount = baseAmount - studentDiscount;
            const prepaidDiscount = truncateToThousands(afterStudentDiscount * rate / 100);
            const finalAmount = afterStudentDiscount - prepaidDiscount;

            const detail = {
                year_month: yearMonth,
                base_amount: baseAmount,
                student_discount: studentDiscount,
                prepaid_discount: status === 'already_paid' ? 0 : prepaidDiscount,
                final_amount: status === 'already_paid' ? 0 : finalAmount,
                status
            };

            monthDetails.push(detail);

            if (status !== 'already_paid') {
                totalFinal += finalAmount;
                totalPrepaidDiscount += prepaidDiscount;
                monthsPayable++;
            } else {
                monthsAlreadyPaid++;
            }
        }

        res.json({
            student_name: decrypt(student.name),
            monthly_tuition: baseAmount,
            student_discount_rate: studentDiscountRate,
            prepaid_discount_rate: rate,
            months: monthDetails,
            total_final: totalFinal,
            total_prepaid_discount: totalPrepaidDiscount,
            months_payable: monthsPayable,
            months_already_paid: monthsAlreadyPaid
        });
    } catch (error) {
        logger.error('Error in prepaid preview:', error);
        res.status(500).json({ error: 'Server Error', message: '선납 미리보기에 실패했습니다.' });
    }
});

/**
 * POST /paca/payments/prepaid-pay
 * 선납 결제 실행 (트랜잭션)
 */
router.post('/prepaid-pay', verifyToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { student_id, months, prepaid_discount_rate, payment_method, payment_date } = req.body;

        // Validation
        if (!student_id || !Array.isArray(months) || months.length < 2 || months.length > 6) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '학생 ID와 2~6개월 범위의 월 목록이 필요합니다.'
            });
        }

        const rate = parseFloat(prepaid_discount_rate);
        if (isNaN(rate) || rate < 0 || rate > 50) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '선납 할인율은 0~50% 범위여야 합니다.'
            });
        }

        if (!payment_method || !['account', 'card', 'cash', 'other'].includes(payment_method)) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 납부 방법을 선택해주세요.'
            });
        }

        const payDate = payment_date || new Date().toISOString().split('T')[0];

        await connection.beginTransaction();

        // 학생 조회
        const [students] = await connection.execute(
            `SELECT s.id, s.name, s.monthly_tuition, s.discount_rate, s.payment_due_day, s.status, s.academy_id,
                    a.tuition_due_day
             FROM students s
             LEFT JOIN academy_settings a ON s.academy_id = a.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Not Found', message: '학생을 찾을 수 없습니다.' });
        }

        const student = students[0];
        if (student.status !== 'active') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'Validation Error', message: '재원 중인 학생만 선납 결제가 가능합니다.' });
        }

        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const studentDiscountRate = parseFloat(student.discount_rate) || 0;
        const dueDay = student.payment_due_day || student.tuition_due_day || 5;
        const prepaidGroupId = crypto.randomUUID();

        const monthsProcessed = [];
        const monthsSkipped = [];
        let totalAmount = 0;
        let totalDiscount = 0;

        for (const yearMonth of months) {
            // 기존 레코드 SELECT FOR UPDATE
            const [existing] = await connection.execute(
                'SELECT id, payment_status, paid_amount, final_amount FROM student_payments WHERE student_id = ? AND `year_month` = ? AND payment_type = ? FOR UPDATE',
                [student_id, yearMonth, 'monthly']
            );

            // 이미 완납이면 skip
            if (existing.length > 0 && existing[0].payment_status === 'paid') {
                monthsSkipped.push(yearMonth);
                continue;
            }

            // 금액 계산
            const studentDiscount = truncateToThousands(baseAmount * studentDiscountRate / 100);
            const afterStudentDiscount = baseAmount - studentDiscount;
            const prepaidDiscount = truncateToThousands(afterStudentDiscount * rate / 100);
            const finalAmount = afterStudentDiscount - prepaidDiscount;
            const totalDiscountAmount = studentDiscount + prepaidDiscount;

            const [year, month] = yearMonth.split('-').map(Number);
            const dueDateStr = new Date(year, month - 1, dueDay).toISOString().split('T')[0];
            const prepaidNote = `[선납 ${months.length}개월] ${rate}% 할인 (${prepaidDiscount.toLocaleString()}원)`;

            if (existing.length === 0) {
                // INSERT 새 레코드 (paid 상태로)
                await connection.execute(
                    `INSERT INTO student_payments (
                        student_id, academy_id, \`year_month\`, payment_type,
                        base_amount, discount_amount, additional_amount, final_amount,
                        paid_amount, paid_date, due_date,
                        payment_status, payment_method, description, notes,
                        recorded_by, prepaid_group_id
                    ) VALUES (?, ?, ?, 'monthly', ?, ?, 0, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)`,
                    [
                        student_id,
                        req.user.academyId,
                        yearMonth,
                        baseAmount,
                        totalDiscountAmount,
                        finalAmount,
                        finalAmount,
                        payDate,
                        dueDateStr,
                        payment_method,
                        `${year}년 ${month}월 학원비`,
                        prepaidNote,
                        req.user.userId,
                        prepaidGroupId
                    ]
                );
            } else {
                // UPDATE 기존 미납 레코드
                await connection.execute(
                    `UPDATE student_payments SET
                        base_amount = ?, discount_amount = ?, final_amount = ?,
                        paid_amount = ?, paid_date = ?,
                        payment_status = 'paid', payment_method = ?,
                        notes = CONCAT(IFNULL(notes, ''), '\n', ?),
                        prepaid_group_id = ?,
                        updated_at = NOW()
                     WHERE id = ?`,
                    [
                        baseAmount,
                        totalDiscountAmount,
                        finalAmount,
                        finalAmount,
                        payDate,
                        payment_method,
                        prepaidNote,
                        prepaidGroupId,
                        existing[0].id
                    ]
                );
            }

            // revenues 테이블 INSERT
            try {
                await connection.execute(
                    `INSERT INTO revenues (
                        academy_id, category, amount, revenue_date,
                        payment_method, student_id, description
                    ) VALUES (?, 'tuition', ?, ?, ?, ?, ?)`,
                    [
                        req.user.academyId,
                        finalAmount,
                        payDate,
                        payment_method,
                        student_id,
                        `선납 결제 - ${yearMonth} (${months.length}개월)`
                    ]
                );
            } catch (revenueError) {
                logger.info('Revenue table insert skipped:', revenueError.message);
            }

            monthsProcessed.push(yearMonth);
            totalAmount += finalAmount;
            totalDiscount += prepaidDiscount;
        }

        await connection.commit();
        connection.release();

        res.json({
            message: `선납 결제가 완료되었습니다. (${monthsProcessed.length}개월)`,
            prepaid_group_id: prepaidGroupId,
            total_amount: totalAmount,
            total_discount: totalDiscount,
            months_processed: monthsProcessed,
            months_skipped: monthsSkipped
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        logger.error('Error in prepaid pay:', error);
        res.status(500).json({ error: 'Server Error', message: '선납 결제에 실패했습니다.' });
    }
});

};
