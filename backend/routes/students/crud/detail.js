/**
 * routes/students/crud/detail.js
 *
 * 학생 상세 조회 (GET /paca/students/:id).
 *
 * ## Endpoint
 * - GET /:id : 학생 + performance (최근 10건) + payment (최근 10건) 한 번에 반환.
 *
 * ## 인증
 * - verifyToken (owner / admin / teacher 모두 조회 가능)
 *
 * ## DB 패턴 (ADR-005)
 * - `pool.execute(sql, params)` 통일 (3건: students JOIN academies / student_performance / student_payments).
 *
 * ## 응답 표면 (ADR-013)
 * - 200: `{student, performances, payments}` — 프론트 `StudentDetailResponse`
 *   (`{message?, student, performances, payments}`) 직접 소비.
 *   ⚠️ message root 키 없음 — 원본 동작 보존.
 * - 404: `{error: 'Not Found', message: '학생 정보를 찾을 수 없습니다.'}` (한국어, ADR-003).
 * - 5xx: `{error: 'Server Error', message: '학생 정보를 불러오지 못했습니다.'}` (한국어, ADR-003).
 *
 * ## 보안 헬퍼 (ADR-007)
 * - `decryptFields(students[0], ENCRYPTED_FIELDS.students)` 시그니처 무변경.
 */

const {
    pool,
    verifyToken,
    decryptFields,
    ENCRYPTED_FIELDS,
    logger
} = require('./_utils');

module.exports = function(router) {

router.get('/:id', verifyToken, async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // Get student basic info
        const [students] = await pool.execute(
            `SELECT
                s.*,
                a.name as academy_name
            FROM students s
            LEFT JOIN academies a ON s.academy_id = a.id
            WHERE s.id = ?
            AND s.academy_id = ?
            AND s.deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생 정보를 찾을 수 없습니다.'
            });
        }

        // 민감 필드 복호화
        const student = decryptFields(students[0], ENCRYPTED_FIELDS.students);

        // Get performance records
        const [performances] = await pool.execute(
            `SELECT
                id,
                record_date,
                record_type,
                performance_data,
                notes,
                created_at
            FROM student_performance
            WHERE student_id = ?
            ORDER BY record_date DESC
            LIMIT 10`,
            [studentId]
        );

        // Get payment records
        const [payments] = await pool.execute(
            `SELECT
                id,
                \`year_month\`,
                payment_type,
                base_amount,
                discount_amount,
                final_amount,
                paid_amount,
                paid_date,
                due_date,
                payment_status,
                payment_method
            FROM student_payments
            WHERE student_id = ?
            ORDER BY due_date DESC
            LIMIT 10`,
            [studentId]
        );

        // 응답 표면 보존 (ADR-013): {student, performances, payments} — message root 키 없음
        res.json({
            student,
            performances,
            payments
        });
    } catch (error) {
        logger.error('Error fetching student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 정보를 불러오지 못했습니다.'
        });
    }
});

};
