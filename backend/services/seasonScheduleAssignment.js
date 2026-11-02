/**
 * 시즌 스케줄 배정 — 시즌 등록(화면 POST /paca/seasons/:id/enroll·AI 연결 season_enroll)과 시즌 활성화가 같이 쓴다.
 * routes/seasons/_utils.js 에서 옮겨 왔고 동작은 그대로다(_utils 가 같은 이름으로 다시 내보낸다).
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * 학생을 시즌 스케줄에 자동 배정 (시즌 기간 동안 운영 요일 + 시간대 별 attendance 생성)
 * 원본 routes/seasons.js (lines 27~144) 동작 1:1 보존.
 */
async function autoAssignStudentToSeasonSchedules(studentId, academyId, season, studentGrade, studentType, customTimeSlots = null, registrationDate = null, dbConn = pool) {
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
                    let [schedules] = await dbConn.execute(
                        `SELECT id FROM class_schedules
                         WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                        [academyId, dateStr, timeSlot]
                    );

                    let scheduleId;
                    if (schedules.length === 0) {
                        const [result] = await dbConn.execute(
                            `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                             VALUES (?, ?, ?, false)`,
                            [academyId, dateStr, timeSlot]
                        );
                        scheduleId = result.insertId;
                        createdCount++;
                    } else {
                        scheduleId = schedules[0].id;
                    }

                    const [existing] = await dbConn.execute(
                        `SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?`,
                        [scheduleId, studentId]
                    );

                    if (existing.length === 0) {
                        await dbConn.execute(
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
 * 기존 정규 스케줄에서 학생 제거 (받은 기간 동안만, 출석 처리 안된 attendance 만)
 * 원본 routes/seasons.js (lines 153~175) 동작 1:1 보존.
 */
async function removeStudentFromRegularSchedules(studentId, academyId, seasonStartDate, seasonEndDate, dbConn = pool) {
    try {
        const [result] = await dbConn.execute(
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
 * 시즌 등록생은 비시즌 종강일 다음 날부터 시즌 끝날 때까지 정규 수업이 없다 (종강~시즌 시작 사이는 수업 없음).
 * 그 첫날을 돌려준다. 비시즌 종강일이 없는 옛 시즌은 시즌 시작일.
 */
function seasonRegularBlockStart(season) {
    if (!season.non_season_end_date) return season.season_start_date;
    const next = new Date(`${season.non_season_end_date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
}

/**
 * fromDate 이후에도 정규 수업이 막히는 시즌 등록 (끝나지 않은 시즌, 취소 안 된 등록) — 시작 전 시즌도 포함.
 * studentId 를 주면 그 학생만. [{ studentId, from, to }] (YYYY-MM-DD, 양 끝 포함)
 */
async function findSeasonRegularBlocks(dbConn, academyId, fromDate, studentId = null) {
    const [rows] = await dbConn.execute(
        `SELECT ss.student_id, se.non_season_end_date, se.season_start_date, se.season_end_date
         FROM student_seasons ss
         JOIN seasons se ON ss.season_id = se.id
         WHERE se.academy_id = ?
         AND se.status != 'ended'
         AND se.season_end_date >= ?
         AND ss.is_cancelled = 0
         AND ss.payment_status != 'cancelled'
         ${studentId ? 'AND ss.student_id = ?' : ''}`,
        studentId ? [academyId, fromDate, studentId] : [academyId, fromDate]
    );
    return rows.map(row => ({
        studentId: row.student_id,
        from: seasonRegularBlockStart(row),
        to: row.season_end_date
    }));
}

module.exports = {
    autoAssignStudentToSeasonSchedules,
    removeStudentFromRegularSchedules,
    seasonRegularBlockStart,
    findSeasonRegularBlocks
};
