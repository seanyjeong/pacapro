/**
 * routes/students/crud/search.js
 *
 * 학생 검색 (GET /paca/students/search) — 자동완성용.
 *
 * ## ⚠️ 등록 순서 — 원본 동작 보존 (ADR-013)
 * - 본 endpoint 는 `index.js` 의 등록 순서에서 GET /:id (detail) 뒤에 등록되어 있다.
 *   express 라우트 매칭 우선순위 상 `/search` 호출이 `/:id` 핸들러에 `:id="search"` 로 잡혀
 *   `parseInt('search') = NaN` 처리됨. 사실상 dead code.
 * - 원본 `routes/students/crud.js` 가 동일하게 `/:id` 뒤에 정의했던 동작을 100% 보존.
 *   별도 트랙 (라우트 정상화 + 프론트 영향 검증) 진행 시 등록 순서를 `detail` 앞으로 이동.
 *
 * ## 인증
 * - verifyToken (owner / admin / teacher 모두 검색 가능)
 *
 * ## DB 패턴 (ADR-005)
 * - `pool.execute(sql, params)` 통일 (1건: students 전체 조회 후 메모리 필터).
 *
 * ## 응답 표면 (ADR-013)
 * - 200: `{message: 'Found N students', students: [...]}` (max 20건) — 프론트 `StudentsResponse` 호환.
 * - 400: `{error: 'Validation Error', message: '검색어를 입력해주세요.'}` (한국어, ADR-003).
 * - 5xx: `{error: 'Server Error', message: '학생 검색에 실패했습니다.'}` (한국어, ADR-003).
 *
 * ## 보안 헬퍼 (ADR-007)
 * - `decrypt(value)` 시그니처 무변경 (name / phone 개별 복호화).
 */

const {
    pool,
    verifyToken,
    decrypt,
    logger
} = require('./_utils');

module.exports = function(router) {

router.get('/search', verifyToken, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 1) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '검색어를 입력해주세요.'
            });
        }

        // 암호화된 데이터 검색을 위해 모든 학생을 가져온 후 메모리에서 필터링
        const [allStudents] = await pool.execute(
            `SELECT
                id,
                student_number,
                name,
                phone,
                grade,
                grade_type
            FROM students
            WHERE academy_id = ?
            AND deleted_at IS NULL
            AND status = 'active'`,
            [req.user.academyId]
        );

        // 복호화 후 검색
        const searchLower = q.toLowerCase();
        const students = allStudents
            .map(s => ({
                ...s,
                name: s.name ? decrypt(s.name) : s.name,
                phone: s.phone ? decrypt(s.phone) : s.phone
            }))
            .filter(s => {
                const name = (s.name || '').toLowerCase();
                const phone = (s.phone || '').toLowerCase();
                const studentNumber = (s.student_number || '').toLowerCase();
                return name.includes(searchLower) ||
                       phone.includes(searchLower) ||
                       studentNumber.includes(searchLower);
            })
            .slice(0, 20);

        // 응답 표면 보존 (ADR-013): {message, students}
        res.json({
            message: `Found ${students.length} students`,
            students
        });
    } catch (error) {
        logger.error('Error searching students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 검색에 실패했습니다.'
        });
    }
});

};
