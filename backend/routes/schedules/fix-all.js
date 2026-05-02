/**
 * paca/schedules/fix-all.js — 잘못된 스케줄 일괄 정리 라우터 (Phase 3 #7, owner only)
 *
 * 마운트: paca.js → routes/schedules/index.js → require('./fix-all')(router)
 *         mount path: '/paca/schedules'
 *
 * Endpoint (1건):
 *   - POST /fix-all — 운영용 일괄 정리 유틸리티 (owner 전용)
 *     - morning/afternoon 시간대 일반 학생 스케줄 삭제 (시즌 학생 제외)
 *     - 수업 요일 불일치 스케줄 삭제
 *     - 11/12월 (2025) evening 시간대로 재배정
 *
 * 인증: verifyToken + requireRole('owner') (owner 만 호출 가능).
 *
 * 응답 표면 보존 (ADR-013):
 *     - POST /fix-all → { message, results }
 *         results: { deleted_attendance, deleted_empty_schedules, created_schedules,
 *                    assigned_attendance, details: string[] }
 *     - 5xx          → { error, message }   (단, 원본은 message: error.message || 'Failed...' 사용 — 시스템 정보 노출 가능)
 *
 * **원본 동작 보존 (ADR-013 / lesson #228 변형)**:
 *   원본 5xx 응답이 `message: error.message || 'Failed to fix schedules'` 로 e.message 직접 노출.
 *   이는 ADR-003 (사용자 노출 e.message 차단) 위반이지만 owner 전용 + 운영 디버깅 의도.
 *   분리 단계에서는 동작 1:1 보존 (별도 트랙으로 fix). JSDoc 으로 보존 사유 명시.
 *
 *   원본 동작에서 try 첫 줄에 results 객체 생성 → 큰 catch 블록 외부에서는 `connection.release()` 만
 *   호출하고 rollback 안 함 (트랜잭션 시작 자체를 안 함). 이 동작 그대로 보존 (DELETE 가 commit 으로
 *   바로 반영됨 — 의도적인지 버그인지 명확하지 않으나 운영 중 — 별도 트랙).
 *
 * DB 호출 (ADR-005): 원본 connection.query 그대로 보존 (분리 단계 — pool/conn alias).
 *
 * ADR-016 IN 절: 1건 — `DELETE FROM attendance WHERE id IN (?)` 자동 펼침 의존.
 *   분리 단계에서는 원본 동작 1:1 보존. pool.execute 단독 마이그레이션 시 명시 전개 필요.
 *
 * 보안 (ADR-007): decrypt 미사용 (학생 ID/이름 raw 만 사용). 단, requireRole('owner') 강제.
 *
 * 분리 결정 (ADR-006): 단일 파일 ~190줄 — 분리 불요.
 */

const { db, logger } = require('./_utils');
const { verifyToken, requireRole } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * POST /paca/schedules/fix-all
 * 잘못된 스케줄 일괄 정리 (owner 전용)
 * - morning/afternoon 시간대 스케줄 삭제 (시즌 학생 제외)
 * - 수업요일 불일치 스케줄 삭제
 * - evening 시간대로 재배정
 */
router.post('/fix-all', verifyToken, requireRole('owner'), async (req, res) => {
    const connection = await db.getConnection();

    try {
        const results = {
            deleted_attendance: 0,
            deleted_empty_schedules: 0,
            created_schedules: 0,
            assigned_attendance: 0,
            details: []
        };

        // 1. 잘못된 스케줄 조회 (일반 학생의 morning/afternoon 또는 요일 불일치)
        // 11월 1일부터 모든 날짜 대상 (과거 포함)
        const [wrongSchedules] = await connection.query(`
            SELECT
                a.id as attendance_id,
                a.student_id,
                s.name as student_name,
                s.grade,
                s.class_days,
                cs.id as schedule_id,
                cs.class_date,
                cs.time_slot,
                DAYOFWEEK(cs.class_date) - 1 as day_of_week
            FROM attendance a
            JOIN class_schedules cs ON a.class_schedule_id = cs.id
            JOIN students s ON a.student_id = s.id
            LEFT JOIN student_seasons ss ON s.id = ss.student_id AND ss.is_cancelled = 0
            WHERE cs.academy_id = ?
            AND cs.class_date >= '2025-11-01'
            AND s.status = 'active'
            AND s.deleted_at IS NULL
            AND ss.id IS NULL
            AND a.attendance_status IS NULL
            AND (
                cs.time_slot IN ('morning', 'afternoon')
                OR (
                    NOT JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(DAYOFWEEK(cs.class_date) - 1 AS JSON))
                    AND NOT JSON_CONTAINS(COALESCE(s.class_days, '[]'), JSON_OBJECT('day', DAYOFWEEK(cs.class_date) - 1))
                )
            )
            ORDER BY s.name, cs.class_date
        `, [req.user.academyId]);

        results.details.push(`발견된 잘못된 스케줄: ${wrongSchedules.length}개`);

        // 2. 잘못된 출석 기록 삭제
        if (wrongSchedules.length > 0) {
            const attendanceIds = wrongSchedules.map(w => w.attendance_id);
            const [deleteResult] = await connection.query(
                `DELETE FROM attendance WHERE id IN (?)`,
                [attendanceIds]
            );
            results.deleted_attendance = deleteResult.affectedRows;
        }

        // 3. 빈 스케줄 삭제 (11월 1일 이후)
        const [emptyScheduleResult] = await connection.query(`
            DELETE cs FROM class_schedules cs
            LEFT JOIN attendance a ON cs.id = a.class_schedule_id
            WHERE cs.academy_id = ?
            AND a.id IS NULL
            AND cs.class_date >= '2025-11-01'
        `, [req.user.academyId]);
        results.deleted_empty_schedules = emptyScheduleResult.affectedRows;

        // 4. 올바른 스케줄로 재배정
        const [activeStudents] = await connection.query(`
            SELECT s.id, s.name, s.academy_id, s.class_days
            FROM students s
            LEFT JOIN student_seasons ss ON s.id = ss.student_id AND ss.is_cancelled = 0
            WHERE s.academy_id = ?
            AND s.status = 'active'
            AND s.deleted_at IS NULL
            AND s.class_days IS NOT NULL
            AND s.class_days != '[]'
            AND ss.id IS NULL
        `, [req.user.academyId]);

        results.details.push(`재배정 대상 학생: ${activeStudents.length}명`);

        // 11월과 12월 모두 재배정 (2025년)
        const monthsToProcess = [
            { year: 2025, month: 10 },  // 11월 (0-indexed)
            { year: 2025, month: 11 }   // 12월
        ];

        for (const student of activeStudents) {
            const classDays = typeof student.class_days === 'string'
                ? JSON.parse(student.class_days)
                : student.class_days;

            if (!Array.isArray(classDays) || classDays.length === 0) continue;

            for (const { year, month } of monthsToProcess) {
                const firstDay = 1;
                const lastDay = new Date(year, month + 1, 0).getDate();

                for (let day = firstDay; day <= lastDay; day++) {
                    const currentDate = new Date(year, month, day);
                    const dayOfWeek = currentDate.getDay();

                    if (classDays.includes(dayOfWeek)) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                        // evening 스케줄 조회 또는 생성
                        let [schedules] = await connection.query(
                            `SELECT id FROM class_schedules
                             WHERE academy_id = ? AND class_date = ? AND time_slot = 'evening'`,
                            [student.academy_id, dateStr]
                        );

                        let scheduleId;
                        if (schedules.length === 0) {
                            const [result] = await connection.query(
                                `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                                 VALUES (?, ?, 'evening', false)`,
                                [student.academy_id, dateStr]
                            );
                            scheduleId = result.insertId;
                            results.created_schedules++;
                        } else {
                            scheduleId = schedules[0].id;
                        }

                        // 이미 배정되어 있는지 확인
                        const [existing] = await connection.query(
                            `SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?`,
                            [scheduleId, student.id]
                        );

                        if (existing.length === 0) {
                            await connection.query(
                                `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                                 VALUES (?, ?, NULL)`,
                                [scheduleId, student.id]
                            );
                            results.assigned_attendance++;
                        }
                    }
                }
            }
        }

        connection.release();

        res.json({
            message: '스케줄 정리 완료',
            results
        });

    } catch (error) {
        connection.release();
        logger.error('Error fixing schedules:', error);
        // 원본 동작 보존 (ADR-013): 5xx 응답이 e.message 직접 노출 — owner 전용 디버깅 의도.
        // 별도 트랙으로 한국어 친화 메시지 + e.message 차단 진행 권장.
        res.status(500).json({
            error: 'Server Error',
            message: error.message || 'Failed to fix schedules'
        });
    }
});

};
