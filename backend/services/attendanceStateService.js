const repository = require('../repositories/attendanceStateRepository');
const { decrypt } = require('../utils/encryption');

function dateOnly(value) {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function getAttendanceState(academyId, scheduleId) {
    const schedule = await repository.findSchedule(academyId, scheduleId);
    if (!schedule) return null;
    const date = dateOnly(schedule.class_date);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const recorded = await repository.findRecordedStudents(academyId, scheduleId);
    const eligible = await repository.findEligibleStudents(academyId, date, schedule.time_slot, weekday);
    // 조회만으로 출석 행을 만들거나 보충 예정자를 출석 처리하지 않는다.
    const students = new Map(eligible.map((student) => [Number(student.student_id), {
        ...student, attendance_status: null, notes: null, makeup_date: null, is_makeup: 0,
    }]));
    for (const student of recorded) students.set(Number(student.student_id), student);
    return {
        schedule: { ...schedule, class_date: date },
        capabilities: { individualAttendance: true },
        students: [...students.values()].sort((a, b) => Number(a.student_id) - Number(b.student_id))
            .map((student) => ({
                ...student,
                student_name: student.student_name ? decrypt(student.student_name) : student.student_name,
                makeup_date: student.makeup_date ? dateOnly(student.makeup_date) : null,
            })),
    };
}

module.exports = { getAttendanceState };
