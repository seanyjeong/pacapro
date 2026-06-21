/**
 * Attendance Validator
 * 학생과 스케줄의 academy_id 일치 여부를 검증하여
 * 다른 학원의 데이터가 섞이는 것을 방지
 */

const db = require('../config/database');

/**
 * 학생이 해당 스케줄에 attendance 생성 가능한지 검증
 * @param {number} studentId - 학생 ID
 * @param {number} scheduleId - class_schedule ID
 * @param {object} connection - DB connection (트랜잭션용, 선택)
 * @returns {Promise<{valid: boolean, error?: string, studentAcademyId?: number, scheduleAcademyId?: number}>}
 */
async function validateAttendance(studentId, scheduleId, connection = null) {
    const dbConn = connection || db;

    try {
        // 학생의 academy_id 조회
        const [students] = await dbConn.query(
            'SELECT academy_id FROM students WHERE id = ? AND deleted_at IS NULL',
            [studentId]
        );

        if (students.length === 0) {
            return { valid: false, error: `Student not found: ${studentId}` };
        }

        // 스케줄의 academy_id 조회
        const [schedules] = await dbConn.query(
            'SELECT academy_id FROM class_schedules WHERE id = ?',
            [scheduleId]
        );

        if (schedules.length === 0) {
            return { valid: false, error: `Schedule not found: ${scheduleId}` };
        }

        const studentAcademyId = students[0].academy_id;
        const scheduleAcademyId = schedules[0].academy_id;

        if (studentAcademyId !== scheduleAcademyId) {
            console.error(`[SECURITY] Academy mismatch! Student ${studentId} (academy: ${studentAcademyId}) -> Schedule ${scheduleId} (academy: ${scheduleAcademyId})`);
            return {
                valid: false,
                error: `Academy mismatch: student belongs to academy ${studentAcademyId}, schedule belongs to academy ${scheduleAcademyId}`,
                studentAcademyId,
                scheduleAcademyId
            };
        }

        return { valid: true, studentAcademyId, scheduleAcademyId };
    } catch (error) {
        console.error('[SECURITY] Error validating attendance:', error);
        return { valid: false, error: error.message };
    }
}

/**
 * 여러 학생의 attendance 생성 전 일괄 검증
 * @param {number[]} studentIds - 학생 ID 배열
 * @param {number} scheduleId - class_schedule ID
 * @param {object} connection - DB connection (트랜잭션용, 선택)
 * @returns {Promise<{valid: boolean, invalidStudents?: number[], error?: string}>}
 */
async function validateBatchAttendance(studentIds, scheduleId, connection = null) {
    const dbConn = connection || db;

    try {
        // 스케줄의 academy_id 조회
        const [schedules] = await dbConn.query(
            'SELECT academy_id FROM class_schedules WHERE id = ?',
            [scheduleId]
        );

        if (schedules.length === 0) {
            return { valid: false, error: `Schedule not found: ${scheduleId}` };
        }

        const scheduleAcademyId = schedules[0].academy_id;

        // 학생들의 academy_id 일괄 조회
        const [students] = await dbConn.query(
            'SELECT id, academy_id FROM students WHERE id IN (?) AND deleted_at IS NULL',
            [studentIds]
        );

        const invalidStudents = students
            .filter(s => s.academy_id !== scheduleAcademyId)
            .map(s => s.id);

        if (invalidStudents.length > 0) {
            console.error(`[SECURITY] Academy mismatch in batch! Schedule ${scheduleId} (academy: ${scheduleAcademyId}), invalid students: ${invalidStudents.join(', ')}`);
            return {
                valid: false,
                error: `Academy mismatch for students: ${invalidStudents.join(', ')}`,
                invalidStudents
            };
        }

        return { valid: true };
    } catch (error) {
        console.error('[SECURITY] Error validating batch attendance:', error);
        return { valid: false, error: error.message };
    }
}

/**
 * 검증 후 attendance INSERT (단일)
 * @param {number} scheduleId - class_schedule ID
 * @param {number} studentId - 학생 ID
 * @param {string|null} attendanceStatus - 출석 상태 (null, 'present', 'absent', 'late', 'excused')
 * @param {boolean} isMakeup - 보강 여부
 * @param {object} connection - DB connection (트랜잭션용, 선택)
 * @returns {Promise<{success: boolean, insertId?: number, error?: string}>}
 */
async function createAttendanceWithValidation(scheduleId, studentId, attendanceStatus = null, isMakeup = false, connection = null) {
    const dbConn = connection || db;

    // 1. 검증
    const validation = await validateAttendance(studentId, scheduleId, connection);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    // 2. 중복 체크
    const [existing] = await dbConn.query(
        'SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?',
        [scheduleId, studentId]
    );

    if (existing.length > 0) {
        return { success: true, insertId: existing[0].id, alreadyExists: true };
    }

    // 3. INSERT
    const [result] = await dbConn.query(
        `INSERT INTO attendance (class_schedule_id, student_id, attendance_status, is_makeup)
         VALUES (?, ?, ?, ?)`,
        [scheduleId, studentId, attendanceStatus, isMakeup ? 1 : 0]
    );

    return { success: true, insertId: result.insertId };
}

module.exports = {
    validateAttendance,
    validateBatchAttendance,
    createAttendanceWithValidation
};
