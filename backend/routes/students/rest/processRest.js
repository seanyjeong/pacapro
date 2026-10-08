const { omitStudentParentNames } = require('../../../services/studentParentNameService');
const pool = require('../../../config/database');
const { verifyToken, checkPermission } = require('../../../middleware/auth');
const logger = require('../../../utils/logger');
const lifecycleBilling = require('../../../services/studentLifecycleBillingService');
const { LinkError } = require('../../../models/maxEngineError');
const lifecycleCredit = require('../../../services/studentLifecycleCreditService');

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
            `SELECT id, name, monthly_tuition, discount_rate, status, academy_id, rest_start_date
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
            previousDate: student.status === 'paused' ? student.rest_start_date : null,
            reason: rest_reason || null,
            student, creditType: credit_type || 'none', restEndDate: rest_end_date || null,
            sourcePaymentId: source_payment_id ?? null, expectedPreviewHash: req.body.billing_preview_hash,
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

        const restCredit = await lifecycleCredit.persist(conn, billingContext, unpaidAdjustment?.credit);

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
