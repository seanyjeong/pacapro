/**
 * paca/schedules/_utils.js — schedules 도메인 sub-라우터 공통 유틸 (Phase 3 #7)
 *
 * 사용처: schedules/{list,slot,crud,attendance,instructor-attendance,instructor-schedules,fix-all}.js
 *
 * 제공:
 *   - pool/db (mysql2 promise pool, ADR-005/ADR-011 alias)
 *   - decrypt (utils/encryption — ADR-007 보안 헬퍼 시그니처 무변경)
 *   - decryptScheduleNames(schedules) — 스케줄 배열 결과의 instructor_name/student_name 복호화
 *   - decryptSchedule(schedule) — 단일 스케줄 결과 복호화
 *   - validateAttendance (utils/attendanceValidator — 학생-학원 소속 검증)
 *   - updateSalaryFromAttendance (utils/salaryCalculator — 급여 자동 계산)
 *   - logger (utils/logger)
 *
 * 본 _utils.js 는 hoisting/공유 헬퍼만 둔다. endpoint 핸들러는 sub-라우터에 둔다.
 *
 * ADR-016 IN 절: 본 파일에는 IN 절 사용 0건 (헬퍼들이 단일 row 변환만 수행).
 *
 * 보안 (ADR-007):
 *   - decrypt 시그니처 무변경 — 그대로 utils/encryption 의 decrypt 재사용.
 *   - validateAttendance 시그니처 무변경 — 학생-학원 소속 위반 차단 보안 함수.
 *   - updateSalaryFromAttendance 첫 인자 = mysql2 promise pool 또는 connection 인스턴스 (호환).
 */

const pool = require('../../config/database');
const { decrypt } = require('../../utils/encryption');
const { validateAttendance } = require('../../utils/attendanceValidator');
const { updateSalaryFromAttendance } = require('../../utils/salaryCalculator');
const logger = require('../../utils/logger');

// pool 의 alias (ADR-011 — 신규 표준은 pool, 호환을 위해 db 도 노출)
const db = pool;

/**
 * 스케줄 결과에서 암호화된 이름 필드 복호화 (배열).
 * 원본 routes/schedules.js (lines 11~18) 동작 1:1 보존.
 */
function decryptScheduleNames(schedules) {
    if (!Array.isArray(schedules)) return schedules;
    return schedules.map(schedule => ({
        ...schedule,
        instructor_name: schedule.instructor_name ? decrypt(schedule.instructor_name) : schedule.instructor_name,
        student_name: schedule.student_name ? decrypt(schedule.student_name) : schedule.student_name,
    }));
}

/**
 * 단일 스케줄 복호화.
 * 원본 routes/schedules.js (lines 21~28) 동작 1:1 보존.
 */
function decryptSchedule(schedule) {
    if (!schedule) return schedule;
    return {
        ...schedule,
        instructor_name: schedule.instructor_name ? decrypt(schedule.instructor_name) : schedule.instructor_name,
        student_name: schedule.student_name ? decrypt(schedule.student_name) : schedule.student_name,
    };
}

module.exports = {
    pool,
    db,
    decrypt,
    decryptScheduleNames,
    decryptSchedule,
    validateAttendance,
    updateSalaryFromAttendance,
    logger,
};
