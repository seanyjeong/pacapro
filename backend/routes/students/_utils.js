const db = require('../../config/database');
const logger = require('../../utils/logger');

// ===== 요일별 시간대 유틸리티 (하위호환) =====

/**
 * class_days를 ClassDaySlot 배열로 파싱 (하위호환)
 * - 숫자 배열 [1,3,6] → [{day:1,timeSlot:default}, ...]
 * - 객체 배열 [{day:1,timeSlot:"morning"}] → 그대로
 * - JSON 문자열 → 파싱 후 처리
 */
function parseClassDaysWithSlots(classDays, defaultTimeSlot = 'evening') {
    if (!classDays) return [];

    let arr;
    if (typeof classDays === 'string') {
        try {
            arr = JSON.parse(classDays);
        } catch {
            return [];
        }
    } else {
        arr = classDays;
    }

    if (!Array.isArray(arr)) return [];

    return arr.map(item => {
        if (typeof item === 'number') {
            return { day: item, timeSlot: defaultTimeSlot };
        }
        return { day: item.day, timeSlot: item.timeSlot || defaultTimeSlot };
    });
}

/**
 * ClassDaySlot 배열에서 day 숫자만 추출
 * @example extractDayNumbers([{day:1,timeSlot:"morning"}]) => [1]
 */
function extractDayNumbers(slots) {
    return slots.map(s => s.day);
}

/**
 * 특정 요일의 시간대 조회
 * @example getTimeSlotForDay(slots, 6, 'evening') => 'afternoon'
 */
function getTimeSlotForDay(slots, day, defaultTimeSlot = 'evening') {
    const found = slots.find(s => s.day === day);
    return found ? found.timeSlot : defaultTimeSlot;
}

/**
 * 학생을 해당 월의 스케줄에 자동 배정
 * @param {object} dbConn - 데이터베이스 연결
 * @param {number} studentId - 학생 ID
 * @param {number} academyId - 학원 ID
 * @param {array} classDays - 수업 요일 (숫자 배열 [1,3,6] 또는 객체 배열 [{day:1,timeSlot:"morning"}])
 * @param {string} enrollmentDate - 등록일 (YYYY-MM-DD)
 * @param {string} defaultTimeSlot - 기본 시간대 (숫자 배열일 때 사용)
 */
async function autoAssignStudentToSchedules(dbConn, studentId, academyId, classDays, enrollmentDate, defaultTimeSlot = 'evening') {
    try {
        // 하위호환: 어떤 포맷이든 ClassDaySlot 배열로 변환
        const slots = parseClassDaysWithSlots(classDays, defaultTimeSlot);
        if (slots.length === 0) {
            logger.info('No class days specified, skipping auto-assignment');
            return { assigned: 0, created: 0 };
        }

        const dayNumbers = extractDayNumbers(slots);
        const enrollDate = new Date(enrollmentDate + 'T00:00:00');
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // 등록일이 미래 월이면 스케줄 생성 생략 (해당 월에 크론이 자동 생성)
        if (enrollDate.getFullYear() > currentYear ||
            (enrollDate.getFullYear() === currentYear && enrollDate.getMonth() > currentMonth)) {
            logger.info(`Student ${studentId}: enrollment_date ${enrollmentDate} is future month, skipping auto-assign (cron will handle)`);
            return { assigned: 0, created: 0 };
        }

        const year = enrollDate.getFullYear();
        const month = enrollDate.getMonth();
        const enrollDay = enrollDate.getDate();
        const lastDay = new Date(year, month + 1, 0).getDate();

        let assignedCount = 0;
        let createdCount = 0;

        // 등록일부터 해당 월 말일까지 수업일 찾기
        for (let day = enrollDay; day <= lastDay; day++) {
            const currentDate = new Date(year, month, day);
            const dayOfWeek = currentDate.getDay();

            if (dayNumbers.includes(dayOfWeek)) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                // 해당 요일의 시간대 조회
                const timeSlot = getTimeSlotForDay(slots, dayOfWeek, defaultTimeSlot);

                // 해당 날짜+시간대의 스케줄 조회 또는 생성
                let [schedules] = await dbConn.query(
                    `SELECT id FROM class_schedules
                     WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                    [academyId, dateStr, timeSlot]
                );

                let scheduleId;
                if (schedules.length === 0) {
                    // 스케줄 생성
                    const [result] = await dbConn.query(
                        `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                         VALUES (?, ?, ?, false)`,
                        [academyId, dateStr, timeSlot]
                    );
                    scheduleId = result.insertId;
                    createdCount++;
                } else {
                    scheduleId = schedules[0].id;
                }

                // 이미 배정되어 있는지 확인
                const [existing] = await dbConn.query(
                    `SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?`,
                    [scheduleId, studentId]
                );

                if (existing.length === 0) {
                    // 출석 기록 생성 (배정)
                    await dbConn.query(
                        `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                         VALUES (?, ?, NULL)`,
                        [scheduleId, studentId]
                    );
                    assignedCount++;
                }
            }
        }

        logger.info(`Auto-assigned student ${studentId}: ${assignedCount} schedules (${createdCount} new)`);
        return { assigned: assignedCount, created: createdCount };
    } catch (error) {
        logger.error('Error in autoAssignStudentToSchedules:', error);
        throw error;
    }
}

/**
 * 학생 요일 변경 시 스케줄 재배정
 * - 기존 미출석 기록 삭제 (오늘 이후)
 * - 새 요일로 재배정 (오늘 이후 ~ 월말)
 */
async function reassignStudentSchedules(dbConn, studentId, academyId, oldClassDays, newClassDays, defaultTimeSlot = 'evening') {
    try {
        // 하위호환: 어떤 포맷이든 ClassDaySlot 배열로 변환
        const newSlots = parseClassDaysWithSlots(newClassDays, defaultTimeSlot);
        const newDayNumbers = extractDayNumbers(newSlots);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        // 등록일 조회: 등록일 이전에는 스케줄 배정하지 않음
        const [studentRows] = await dbConn.query(
            'SELECT enrollment_date FROM students WHERE id = ?',
            [studentId]
        );
        const enrollmentDate = studentRows[0]?.enrollment_date
            ? new Date(studentRows[0].enrollment_date + 'T00:00:00')
            : null;

        // 시작일: 오늘과 등록일 중 더 늦은 날짜
        const startDate = enrollmentDate && enrollmentDate > today ? enrollmentDate : today;

        const year = today.getFullYear();
        const month = today.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();

        // 1. 오늘 이후 미출석 기록 삭제 (출석 처리 안된 것만)
        const [deleteResult] = await dbConn.query(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
             AND cs.academy_id = ?
             AND cs.class_date >= ?
             AND a.attendance_status IS NULL`,
            [studentId, academyId, todayStr]
        );

        logger.info(`Removed ${deleteResult.affectedRows} future attendance records for student ${studentId}`);

        // 2. 새 요일로 재배정 (시작일부터 월말까지) - 등록일 이전 배정 방지
        let assignedCount = 0;
        let createdCount = 0;

        for (let day = startDate.getDate(); day <= lastDay; day++) {
            const currentDate = new Date(year, month, day);
            const dayOfWeek = currentDate.getDay();

            if (newDayNumbers.includes(dayOfWeek)) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                // 해당 요일의 시간대 조회
                const timeSlot = getTimeSlotForDay(newSlots, dayOfWeek, defaultTimeSlot);

                // 해당 날짜+시간대의 스케줄 조회 또는 생성
                let [schedules] = await dbConn.query(
                    `SELECT id FROM class_schedules
                     WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                    [academyId, dateStr, timeSlot]
                );

                let scheduleId;
                if (schedules.length === 0) {
                    const [result] = await dbConn.query(
                        `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                         VALUES (?, ?, ?, false)`,
                        [academyId, dateStr, timeSlot]
                    );
                    scheduleId = result.insertId;
                    createdCount++;
                } else {
                    scheduleId = schedules[0].id;
                }

                // 이미 배정되어 있는지 확인
                const [existing] = await dbConn.query(
                    `SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?`,
                    [scheduleId, studentId]
                );

                if (existing.length === 0) {
                    await dbConn.query(
                        `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                         VALUES (?, ?, NULL)`,
                        [scheduleId, studentId]
                    );
                    assignedCount++;
                }
            }
        }

        logger.info(`Reassigned student ${studentId}: ${assignedCount} schedules (${createdCount} new)`);
        return { removed: deleteResult.affectedRows, assigned: assignedCount, created: createdCount };
    } catch (error) {
        logger.error('Error in reassignStudentSchedules:', error);
        throw error;
    }
}

/**
 * 천원 단위 절삭
 */
function truncateToThousands(amount) {
    return Math.floor(amount / 100) * 100;
}

/**
 * 기간 내 수업 횟수 계산
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 * @param {array} classDays - 수업 요일 배열 (숫자 배열 or 객체 배열)
 * @returns {object} { count: 수업횟수, dates: 수업일 배열 }
 */
function countClassDaysInPeriod(startDate, endDate, classDays) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const classDates = [];
    // 하위호환: 객체 배열이면 day 숫자만 추출
    const dayNumbers = extractDayNumbers(parseClassDaysWithSlots(classDays));

    const current = new Date(start);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayNumbers.includes(dayOfWeek)) {
            classDates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
    }

    return {
        count: classDates.length,
        dates: classDates.map(d => {
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const dayName = dayNames[d.getDay()];
            return `${month}/${day}(${dayName})`;
        })
    };
}

module.exports = {
    parseClassDaysWithSlots,
    extractDayNumbers,
    getTimeSlotForDay,
    autoAssignStudentToSchedules,
    reassignStudentSchedules,
    truncateToThousands,
    countClassDaysInPeriod,
};
