/**
 * paca/seasons/_utils.js — seasons 도메인 sub-라우터 공통 유틸
 *
 * 사용처: seasons/{list,crud,enrollments,enroll,students}.js
 *
 * 제공:
 *   - pool/db (mysql2 promise pool, ADR-005/ADR-011 alias)
 *   - decrypt (utils/encryption — ADR-007 보안 헬퍼 시그니처 무변경)
 *   - logger (utils/logger)
 *   - seasonCalculator 헬퍼 5종
 *   - 시즌 스케줄 자동 배치 헬퍼 3종 (autoAssign / removeFromRegular / autoAssignAll)
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

// pool 의 alias (ADR-011 — 신규 표준은 pool, 호환을 위해 db 도 노출)
const db = pool;

/**
 * 학생을 시즌 스케줄에 자동 배정 (시즌 기간 동안 운영 요일 + 시간대 별 attendance 생성)
 * 원본 routes/seasons.js (lines 27~144) 동작 1:1 보존.
 */
async function autoAssignStudentToSeasonSchedules(studentId, academyId, season, studentGrade, studentType, customTimeSlots = null, registrationDate = null) {
    try {
        const operatingDays = typeof season.operating_days === 'string'
            ? JSON.parse(season.operating_days)
            : season.operating_days;

        const gradeTimeSlots = season.grade_time_slots
            ? (typeof season.grade_time_slots === 'string'
                ? JSON.parse(season.grade_time_slots)
                : season.grade_time_slots)
            : null;

        let timeSlots = [];

        if (customTimeSlots && Array.isArray(customTimeSlots) && customTimeSlots.length > 0) {
            timeSlots = customTimeSlots;
        } else if (gradeTimeSlots) {
            if (gradeTimeSlots[studentGrade]) {
                const slot = gradeTimeSlots[studentGrade];
                timeSlots = Array.isArray(slot) ? slot : [slot];
            } else if (gradeTimeSlots[studentType]) {
                const slot = gradeTimeSlots[studentType];
                timeSlots = Array.isArray(slot) ? slot : [slot];
            } else {
                timeSlots = ['evening'];
            }
        } else {
            timeSlots = ['evening'];
        }

        const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
        const numericDays = operatingDays.map(d => typeof d === 'string' ? dayMap[d] : d).filter(d => d !== undefined);

        if (numericDays.length === 0) {
            logger.info('No operating days specified for season, skipping auto-assignment');
            return { assigned: 0, created: 0, timeSlots: [] };
        }

        const seasonStartDate = new Date(season.season_start_date + 'T00:00:00');
        const endDate = new Date(season.season_end_date + 'T00:00:00');

        let startDate = seasonStartDate;
        if (registrationDate) {
            const regDate = new Date(registrationDate + 'T00:00:00');
            if (regDate > seasonStartDate) {
                startDate = regDate;
                logger.info(`Mid-season enrollment: starting from registration date ${registrationDate} instead of season start ${season.season_start_date}`);
            }
        }

        let assignedCount = 0;
        let createdCount = 0;

        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();

            if (numericDays.includes(dayOfWeek)) {
                const dateStr = currentDate.toISOString().split('T')[0];

                for (const timeSlot of timeSlots) {
                    let [schedules] = await pool.execute(
                        `SELECT id FROM class_schedules
                         WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                        [academyId, dateStr, timeSlot]
                    );

                    let scheduleId;
                    if (schedules.length === 0) {
                        const [result] = await pool.execute(
                            `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                             VALUES (?, ?, ?, false)`,
                            [academyId, dateStr, timeSlot]
                        );
                        scheduleId = result.insertId;
                        createdCount++;
                    } else {
                        scheduleId = schedules[0].id;
                    }

                    const [existing] = await pool.execute(
                        `SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?`,
                        [scheduleId, studentId]
                    );

                    if (existing.length === 0) {
                        await pool.execute(
                            `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                             VALUES (?, ?, NULL)`,
                            [scheduleId, studentId]
                        );
                        assignedCount++;
                    }
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        logger.info(`Season auto-assigned student ${studentId}: ${assignedCount} schedules (${createdCount} new), timeSlots: ${timeSlots.join(', ')}`);
        return { assigned: assignedCount, created: createdCount, timeSlots };
    } catch (error) {
        logger.error('Error in autoAssignStudentToSeasonSchedules:', error);
        throw error;
    }
}

/**
 * 기존 정규 스케줄에서 학생 제거 (시즌 기간 동안만, 출석 처리 안된 attendance 만)
 * 원본 routes/seasons.js (lines 153~175) 동작 1:1 보존.
 */
async function removeStudentFromRegularSchedules(studentId, academyId, seasonStartDate, seasonEndDate) {
    try {
        const [result] = await pool.execute(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
             AND cs.academy_id = ?
             AND cs.class_date >= ?
             AND cs.class_date <= ?
             AND a.attendance_status IS NULL`,
            [studentId, academyId, seasonStartDate, seasonEndDate]
        );

        logger.info(`Removed ${result.affectedRows} regular schedule assignments for student ${studentId} during season period`);
        return { removed: result.affectedRows };
    } catch (error) {
        logger.error('Error in removeStudentFromRegularSchedules:', error);
        throw error;
    }
}

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
    autoAssignAllSeasonStudentsToSchedules
};
