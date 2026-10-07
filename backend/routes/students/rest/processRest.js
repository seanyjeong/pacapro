const { omitStudentParentNames } = require('../../../services/studentParentNameService');
const pool = require('../../../config/database');
const { verifyToken, checkPermission } = require('../../../middleware/auth');
const logger = require('../../../utils/logger');
const lifecycleBilling = require('../../../services/studentLifecycleBillingService');
const { LinkError } = require('../../../models/maxEngineError');

module.exports = function registerProcessRestRoute(router) {
/**
 * POST /paca/students/:id/process-rest
 * 학생 휴원 처리 (이월/환불 크레딧 생성 + 미납금 일할 조정 + 미래 스케줄 정리)
 *
 * Body:
 *   - rest_start_date (필수, YYYY-MM-DD)
 *   - rest_end_date (옵션, YYYY-MM-DD — 없으면 무기한)
 *   - rest_reason (옵션)
 *   - credit_type ('carryover' | 'refund' | 'none')
 *   - source_payment_id (옵션 — 이미 납부한 학원비 ID)
 *
 * 트랜잭션: conn.beginTransaction → conn.execute × N → conn.commit (실패 시 rollback + release).
 * Access: owner, admin
 */
router.post('/:id/process-rest', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1. 학생 존재 확인 및 현재 정보 조회
        const [students] = await conn.execute(
            `SELECT id, name, monthly_tuition, discount_rate, status, academy_id
             FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL FOR UPDATE`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: '학생 정보를 찾을 수 없습니다.'
            });
        }

        const student = students[0];

        const {
            rest_start_date,
            rest_end_date,
            rest_reason,
            credit_type,  // 'carryover' | 'refund' | 'none'
            source_payment_id  // 이미 납부한 학원비 ID (선택)
        } = req.body;

        // 2. 필수 필드 검증
        if (!rest_start_date) {
            await conn.rollback();
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '휴식 시작일은 필수입니다.'
            });
        }
        const billingContext = lifecycleBilling.validateContext({
            academyId: req.user.academyId,
            studentId,
            userId: req.user.id,
            date: rest_start_date,
            reason: rest_reason || null,
        });

        // 3. 학생 상태를 paused로 변경하고 휴식 정보 저장
        await conn.execute(
            `UPDATE students SET
                status = 'paused',
                rest_start_date = ?,
                rest_end_date = ?,
                rest_reason = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [rest_start_date, rest_end_date || null, rest_reason || null, studentId]
        );

        const unpaidAdjustment = await lifecycleBilling.pause(conn, billingContext);

        let restCredit = null;

        // 4. 이월/환불 크레딧 처리
        if (credit_type && credit_type !== 'none') {
            // Reuse an existing valid credit when a committed request is retried.
            const [existingCredits] = await conn.execute(
                `SELECT * FROM rest_credits
                 WHERE student_id = ? AND academy_id = ? AND rest_start_date = ?
                   AND credit_type IN ('carryover', 'refund')
                   AND COALESCE(status, 'pending') <> 'cancelled'
                 ORDER BY id LIMIT 1 FOR UPDATE`,
                [studentId, req.user.academyId, rest_start_date]
            );
            restCredit = existingCredits[0] || null;
            if (!restCredit) {
                // 휴식 기간 계산
                const startDate = new Date(rest_start_date);
                let endDate;

                if (rest_end_date) {
                    endDate = new Date(rest_end_date);
                } else {
                    // 무기한인 경우 해당 월 말일까지로 계산
                    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
                }

                // 해당 월 내 휴식 일수 계산
                const year = startDate.getFullYear();
                const month = startDate.getMonth();
                const monthStart = new Date(year, month, 1);
                const monthEnd = new Date(year, month + 1, 0);
                const daysInMonth = monthEnd.getDate();

                const effectiveStart = startDate > monthStart ? startDate : monthStart;
                const effectiveEnd = endDate < monthEnd ? endDate : monthEnd;
                const restDays = Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;

                // 일할 금액 계산
                const monthlyTuition = parseFloat(student.monthly_tuition) || 0;
                const dailyRate = monthlyTuition / daysInMonth;
                const creditAmount = Math.floor((dailyRate * restDays) / 1000) * 1000;  // 천원 단위 절삭

                if (creditAmount > 0) {
                    // 휴식 크레딧 생성
                    const [creditResult] = await conn.execute(
                        `INSERT INTO rest_credits (
                            student_id,
                            academy_id,
                            source_payment_id,
                            rest_start_date,
                            rest_end_date,
                            rest_days,
                            credit_amount,
                            remaining_amount,
                            credit_type,
                            status,
                            notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                        [
                            studentId,
                            req.user.academyId,
                            source_payment_id || null,
                            rest_start_date,
                            rest_end_date || effectiveEnd.toISOString().split('T')[0],
                            restDays,
                            creditAmount,
                            creditAmount,  // remaining_amount = credit_amount 초기값
                            credit_type,
                            `휴식 기간: ${rest_start_date} ~ ${rest_end_date || '무기한'}, 사유: ${rest_reason || '없음'}`
                        ]
                    );

                    const [credits] = await conn.execute(
                        'SELECT * FROM rest_credits WHERE id = ?',
                        [creditResult.insertId]
                    );
                    restCredit = credits[0];
                }
            }
        }

        // 5. 출결 정리 정책 (사장님 확정 2026-05-04, 퇴원과 동일):
        //  - 휴원 시작일 이전: 보존 (이력)
        //  - 휴원 시작일 당일 (= rest_start_date): 무조건 삭제 (체크된 것도)
        //  - 휴원 시작일 이후: 미체크 (NULL) 만 삭제
        await conn.execute(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
               AND cs.academy_id = ?
               AND (
                 cs.class_date = ?
                 OR (cs.class_date > ? AND a.attendance_status IS NULL)
               )`,
            [studentId, req.user.academyId, rest_start_date, rest_start_date]
        );

        await conn.commit();

        // 업데이트된 학생 정보 조회 (트랜잭션 외부 — 응답용 read)
        const [updatedStudents] = await pool.execute(
            'SELECT * FROM students WHERE id = ?',
            [studentId]
        );

        res.json({
            message: '휴식 처리가 완료되었습니다.',
            student: omitStudentParentNames(updatedStudents[0]),
            restCredit,
            unpaidAdjustment
        });
    } catch (error) {
        await conn.rollback();
        logger.error('Error processing rest:', error);
        if (error instanceof LinkError) {
            return res.status(error.status).json({ error: error.code, message: error.message });
        }
        res.status(500).json({
            error: 'PROCESS_REST_FAILED',
            message: '휴원 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
        });
    } finally {
        conn.release();
    }
});

};
