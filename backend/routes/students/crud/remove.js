/**
 * routes/students/crud/remove.js
 *
 * 학생 완전 삭제 (DELETE /paca/students/:id) — hard delete + cascade.
 *
 * ## Endpoint
 * - DELETE /:id : 학생 + 관련 데이터 (attendance / student_payments / student_performance /
 *   student_seasons / rest_credits / notification_logs) 트랜잭션으로 한 번에 삭제.
 *
 * ## 인증
 * - verifyToken + requireRole('owner') — 학원장만 가능.
 *
 * ## DB 패턴 (ADR-005)
 * - 단일 SELECT 1건은 `pool.execute`.
 * - 트랜잭션은 `pool.getConnection()` + `conn.execute(sql, params)` 패턴.
 *   ⚠️ 동적 테이블명 (`DELETE FROM ${table}`) 은 자리표시자 사용 불가 — 자리표시자 1개 (student_id) 만 binding.
 *   테이블명은 화이트리스트 (tablesToDelete 상수 배열) 에서만 가져와 SQL injection 안전.
 *
 * ## 응답 표면 (ADR-013)
 * - 200: `{message: 'Student deleted permanently', student: {id, name}}` — 프론트
 *   `StudentDeleteResponse` (`{message, student: {id, name}}`) 직접 소비.
 * - 404: `{error: 'Not Found', message: '학생 정보를 찾을 수 없습니다.'}` (한국어, ADR-003).
 * - 5xx: `{error: 'Server Error', message: '학생 삭제에 실패했습니다.'}` (한국어, ADR-003).
 *   ⚠️ 원본의 `detail: error.sqlMessage` 키는 제거 — 사용자 노출 시스템 정보 누출 차단.
 *   디버깅은 logger.error 로 충분.
 *
 * ## 보안 헬퍼 (ADR-007)
 * - 보안 헬퍼 사용 X (테이블 cascade 만 수행).
 */

const {
    pool,
    verifyToken,
    requireRole,
    logger
} = require('./_utils');

module.exports = function(router) {

router.delete('/:id', verifyToken, requireRole('owner'), async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // Check if student exists
        const [students] = await pool.execute(
            'SELECT id, name FROM students WHERE id = ? AND academy_id = ?',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생 정보를 찾을 수 없습니다.'
            });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 관련 데이터 삭제 (출석, 학원비, 성적 등)
            // 테이블 존재 여부와 관계없이 에러 무시하고 삭제 시도
            // ⚠️ 테이블명 화이트리스트 — SQL injection 안전 (사용자 입력 X)
            const tablesToDelete = [
                'attendance',
                'student_payments',
                'student_performance',
                'student_seasons',
                'rest_credits',
                'notification_logs'
            ];

            for (const table of tablesToDelete) {
                try {
                    await connection.execute(`DELETE FROM ${table} WHERE student_id = ?`, [studentId]);
                } catch (tableErr) {
                    // 테이블이 없거나 컬럼이 없으면 무시
                    logger.info(`Skip delete from ${table}: ${tableErr.message}`);
                }
            }

            // 학생 삭제
            await connection.execute('DELETE FROM students WHERE id = ?', [studentId]);

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        // 응답 표면 보존 (ADR-013): {message, student:{id,name}}
        res.json({
            message: 'Student deleted permanently',
            student: {
                id: studentId,
                name: students[0].name
            }
        });
    } catch (error) {
        logger.error('Error deleting student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 삭제에 실패했습니다.'
        });
    }
});

};
