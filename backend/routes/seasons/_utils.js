/**
 * paca/seasons/_utils.js — seasons 도메인 sub-라우터 공통 유틸
 *
 * 사용처: seasons/{list,crud,enrollments,enroll,students}.js, students/rest/resume.js
 *
 * 제공:
 *   - pool/db (mysql2 promise pool, ADR-005/ADR-011 alias)
 *   - decrypt (utils/encryption — ADR-007 보안 헬퍼 시그니처 무변경)
 *   - logger (utils/logger)
 *   - seasonCalculator 헬퍼 5종
 *   - 시즌 스케줄 자동 배치 헬퍼 4종 (autoAssign / removeFromRegular / autoAssignAll / findResumeSeasonEnrollment)
 *
 * 본 _utils.js 는 hoisting/공유 헬퍼만 둔다. endpoint 핸들러는 sub-라우터에 둔다.
 *
 * ADR-016 IN 절: 본 파일에는 IN 절 사용 0건 (헬퍼들이 단일 ID 조회만 수행).
 */

const pool = require('../../config/database');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const {
    calculateProRatedFee,
    calculateSeasonRefund,
    calculateMidSeasonFee,
    parseWeeklyDays,
    previewSeasonTransition,
    truncateToThousands
} = require('../../utils/seasonCalculator');
const {
    autoAssignStudentToSeasonSchedules,
    removeStudentFromRegularSchedules
} = require('../../services/seasonScheduleAssignment');

// pool 의 alias (ADR-011 — 신규 표준은 pool, 호환을 위해 db 도 노출)
const db = pool;

/**
 * 시즌에 등록된 모든 학생을 스케줄에 자동 배정 (시즌 활성화 시 호출)
 * 원본 routes/seasons.js (lines 183~239) 동작 1:1 보존.
 */
async function autoAssignAllSeasonStudentsToSchedules(seasonId, academyId) {
    try {
        const [seasons] = await pool.execute(
            'SELECT * FROM seasons WHERE id = ? AND academy_id = ?',
            [seasonId, academyId]
        );

        if (seasons.length === 0) {
            logger.info(`Season ${seasonId} not found`);
            return { totalAssigned: 0, totalCreated: 0, studentsProcessed: 0 };
        }

        const season = seasons[0];

        const [enrollments] = await pool.execute(
            `SELECT ss.*, s.grade, s.student_type
             FROM student_seasons ss
             JOIN students s ON ss.student_id = s.id
             WHERE ss.season_id = ?
             AND ss.is_cancelled = 0
             AND s.status != 'paused'
             AND s.deleted_at IS NULL`,
            [seasonId]
        );

        let totalAssigned = 0;
        let totalCreated = 0;

        for (const enrollment of enrollments) {
            try {
                const result = await autoAssignStudentToSeasonSchedules(
                    enrollment.student_id,
                    academyId,
                    season,
                    enrollment.grade,
                    enrollment.student_type
                );
                totalAssigned += result.assigned;
                totalCreated += result.created;
            } catch (err) {
                logger.error(`Failed to assign student ${enrollment.student_id}:`, err);
            }
        }

        logger.info(`Season ${seasonId} auto-assigned: ${enrollments.length} students, ${totalAssigned} schedules (${totalCreated} new)`);
        return { totalAssigned, totalCreated, studentsProcessed: enrollments.length };
    } catch (error) {
        logger.error('Error in autoAssignAllSeasonStudentsToSchedules:', error);
        throw error;
    }
}

/**
 * 복귀일 이후에도 진행 중인 시즌 등록 조회 (휴원 복귀 시 정규 대신 시즌 스케줄 배정용)
 * 복귀 트랜잭션 안에서 호출되므로 dbConn 을 그대로 쓴다.
 */
async function findResumeSeasonEnrollment(dbConn, studentId, academyId, resumeDate) {
    const [rows] = await dbConn.execute(
        `SELECT se.*, ss.time_slots AS enrollment_time_slots
         FROM student_seasons ss
         JOIN seasons se ON ss.season_id = se.id
         WHERE ss.student_id = ?
         AND se.academy_id = ?
         AND se.status = 'active'
         AND se.season_end_date >= ?
         AND ss.is_cancelled = 0
         AND ss.payment_status != 'cancelled'
         ORDER BY se.season_start_date ASC
         LIMIT 1`,
        [studentId, academyId, resumeDate]
    );
    if (rows.length === 0) return null;

    const { enrollment_time_slots: rawTimeSlots, ...season } = rows[0];
    const timeSlots = typeof rawTimeSlots === 'string' ? JSON.parse(rawTimeSlots) : rawTimeSlots;
    return { season, timeSlots };
}

module.exports = {
    pool,
    db,
    decrypt,
    logger,
    calculateProRatedFee,
    calculateSeasonRefund,
    calculateMidSeasonFee,
    parseWeeklyDays,
    previewSeasonTransition,
    truncateToThousands,
    autoAssignStudentToSeasonSchedules,
    removeStudentFromRegularSchedules,
    autoAssignAllSeasonStudentsToSchedules,
    findResumeSeasonEnrollment
};
