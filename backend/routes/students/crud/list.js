/**
 * routes/students/crud/list.js
 *
 * 학생 목록 조회 (GET /paca/students).
 *
 * ## Endpoint
 * - GET / : 학생 목록 (필터링 + 암호화 필드 복호화 + search 메모리 필터)
 *
 * ## 인증
 * - verifyToken (owner / admin / teacher 모두 조회 가능)
 *
 * ## DB 패턴 (ADR-005)
 * - `pool.execute(sql, params)` 통일.
 * - `status` 필터의 IN 절은 statuses 배열 길이 기반 자리표시자 명시 전개 (ADR-016).
 *
 * ## 응답 표면 (ADR-013)
 * - 200: `{message: 'Found N students', students: [...]}` — 프론트
 *   `src/lib/types/student.ts` `StudentsResponse` (`{message, students[]}`) + axios 인터셉터 호환.
 * - 5xx: `{error: 'Server Error', message: '학생 목록을 불러오지 못했습니다.'}` (한국어, ADR-003).
 *
 * ## 보안 헬퍼 (ADR-007)
 * - `decryptArrayFields(rows, ENCRYPTED_FIELDS.students)` 시그니처 무변경.
 */

const {
    pool,
    verifyToken,
    decryptArrayFields,
    ENCRYPTED_FIELDS,
    logger
} = require('./_utils');

module.exports = function(router) {

router.get('/', verifyToken, async (req, res) => {
    try {
        const { grade, student_type, admission_type, status, gender, search, is_trial } = req.query;

        let query = `
            SELECT
                s.id,
                s.student_number,
                s.name,
                s.gender,
                s.student_type,
                s.phone,
                s.parent_phone,
                s.school,
                s.grade,
                s.age,
                s.admission_type,
                s.class_days,
                s.weekly_count,
                s.monthly_tuition,
                s.discount_rate,
                s.discount_reason,
                s.payment_due_day,
                s.enrollment_date,
                s.status,
                s.rest_start_date,
                s.rest_end_date,
                s.rest_reason,
                s.is_trial,
                s.trial_remaining,
                s.trial_dates,
                s.time_slot,
                s.is_season_registered,
                s.current_season_id,
                s.memo,
                s.class_days_next,
                s.class_days_effective_from,
                s.created_at
            FROM students s
            WHERE s.academy_id = ?
            AND s.deleted_at IS NULL
        `;

        const params = [req.user.academyId];

        // 체험생 필터
        if (is_trial === 'true') {
            query += ' AND s.is_trial = TRUE';
        } else if (is_trial === 'false') {
            query += ' AND (s.is_trial = FALSE OR s.is_trial IS NULL)';
        }
        // is_trial 파라미터가 없으면 모든 학생 반환

        if (grade) {
            query += ' AND s.grade = ?';
            params.push(grade);
        }

        if (student_type) {
            query += ' AND s.student_type = ?';
            params.push(student_type);
        }

        if (admission_type) {
            query += ' AND s.admission_type = ?';
            params.push(admission_type);
        }

        if (gender) {
            query += ' AND s.gender = ?';
            params.push(gender);
        }

        if (status) {
            // 쉼표로 분리된 다중 상태 지원 (예: status=active,paused)
            // ADR-016: IN 절 자리표시자 명시 전개 (이미 statuses 길이 기반 빌드)
            const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
            if (statuses.length === 1) {
                query += ' AND s.status = ?';
                params.push(statuses[0]);
            } else if (statuses.length > 1) {
                query += ` AND s.status IN (${statuses.map(() => '?').join(',')})`;
                params.push(...statuses);
            }
        }

        // search는 복호화 후 메모리에서 필터링 (암호화된 데이터 검색 불가)
        // DB 쿼리에서는 제외

        query += ' ORDER BY s.enrollment_date DESC';

        const [students] = await pool.execute(query, params);

        // 민감 필드 복호화
        let decryptedStudents = decryptArrayFields(students, ENCRYPTED_FIELDS.students);

        // search 파라미터가 있으면 복호화된 데이터에서 필터링
        if (search) {
            const searchLower = search.toLowerCase();
            decryptedStudents = decryptedStudents.filter(s => {
                const name = (s.name || '').toLowerCase();
                const phone = (s.phone || '').toLowerCase();
                const studentNumber = (s.student_number || '').toLowerCase();
                return name.includes(searchLower) ||
                       phone.includes(searchLower) ||
                       studentNumber.includes(searchLower);
            });
        }

        // 응답 표면 보존 (ADR-013): {message, students}
        res.json({
            message: `Found ${decryptedStudents.length} students`,
            students: decryptedStudents
        });
    } catch (error) {
        logger.error('Error fetching students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 목록을 불러오지 못했습니다.'
        });
    }
});

};
