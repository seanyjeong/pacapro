const logger = require('../utils/logger');
const repository = require('../repositories/studentScheduleAssignmentRepository');
const { seasonGapRanges, inSeasonGap } = require('../repositories/seasonGapSchedule');
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

// Share the date/slot plan between the screen writer and the read-only MCP preview.
// seasonGaps: 시즌 공백 기간(repositories/seasonGapSchedule) — 그 날짜는 정규 수업을 배정하지 않는다
function resumeScheduleTargets(classDays, enrollmentDate, defaultTimeSlot = 'evening', seasonGaps = []) {
    const slots = parseClassDaysWithSlots(classDays, defaultTimeSlot);
    const [year, month, start] = enrollmentDate.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const targets = [];
    for (let day = start; day <= last; day++) {
        const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (extractDayNumbers(slots).includes(weekday) && !inSeasonGap(seasonGaps, date)) targets.push({
            date,
            time_slot: getTimeSlotForDay(slots, weekday, defaultTimeSlot),
        });
    }
    return targets;
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
async function autoAssignStudentToSchedules(dbConn, studentId, academyId, classDays, enrollmentDate, defaultTimeSlot = 'evening', options = {}) {
    try {
        // 하위호환: 어떤 포맷이든 ClassDaySlot 배열로 변환
        const slots = parseClassDaysWithSlots(classDays, defaultTimeSlot);
        if (slots.length === 0) {
            logger.info('No class days specified, skipping auto-assignment');
            return { assigned: 0, created: 0 };
        }

        const enrollDate = new Date(enrollmentDate + 'T00:00:00');
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // 등록일이 미래 월이면 스케줄 생성 생략 (해당 월에 크론이 자동 생성)
        if (!options.includeFutureMonth && (enrollDate.getFullYear() > currentYear ||
            (enrollDate.getFullYear() === currentYear && enrollDate.getMonth() > currentMonth))) {
            logger.info(`Student ${studentId}: enrollment_date ${enrollmentDate} is future month, skipping auto-assign (cron will handle)`);
            return { assigned: 0, created: 0 };
        }

        let assignedCount = 0;
        let createdCount = 0;
        const seasonGaps = await seasonGapRanges(dbConn, studentId, academyId);
        for (const target of resumeScheduleTargets(classDays, enrollmentDate, defaultTimeSlot, seasonGaps)) {
            const result = await repository.assign(dbConn, academyId, studentId, target);
            createdCount += result.created;
            assignedCount += result.assigned;
        }

        logger.info(`Auto-assigned student ${studentId}: ${assignedCount} schedules (${createdCount} new)`);
        return { assigned: assignedCount, created: createdCount };
    } catch (error) {
        logger.error('Error in autoAssignStudentToSchedules:', error);
        throw error;
    }
}


module.exports = { resumeScheduleTargets, parseClassDaysWithSlots, extractDayNumbers, getTimeSlotForDay, autoAssignStudentToSchedules };
