const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const TIME_SLOT_LABELS = { morning: '오전반', afternoon: '오후반', evening: '저녁반' };

function buildStudentContext({ student, peakStudent = null, attendanceRows = [], recordRows = [], today, periodDays }) {
  const schedule = classSchedule(student.class_days, student.time_slot || 'evening');
  const recentAttendance = attendanceRows.map((row) => ({
    date: toDateText(row.class_date || row.date),
    weekday: weekdayLabel(row.class_date || row.date),
    time_slot: row.time_slot || '',
    time_slot_label: TIME_SLOT_LABELS[row.time_slot] || row.time_slot || '',
    status: normalizeAttendanceStatus(row.attendance_status),
    notes: row.notes || '',
  }));
  const records = recentRecordSummary(recordRows);
  return {
    student: {
      paca_student_id: Number(student.id),
      peak_student_id: peakStudent ? Number(peakStudent.id) : null,
      name: student.name || '',
      school: student.school || '',
      grade: student.grade || '',
      gender: student.gender || null,
      status: student.status || '',
    },
    period: {
      end_date: today,
      days: periodDays,
    },
    schedule,
    recent_attendance: recentAttendance,
    records,
    message: contextMessage(student, schedule, recentAttendance),
  };
}

function classSchedule(classDays, defaultTimeSlot = 'evening') {
  const slots = parseClassDays(classDays, defaultTimeSlot);
  return slots.map((slot) => ({
    day: slot.day,
    weekday: WEEKDAY_LABELS[slot.day] || '',
    time_slot: slot.timeSlot,
    time_slot_label: TIME_SLOT_LABELS[slot.timeSlot] || slot.timeSlot,
  }));
}

function parseClassDays(classDays, defaultTimeSlot = 'evening') {
  if (!classDays) return [];
  const parsed = typeof classDays === 'string' ? safeJsonParse(classDays) : classDays;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      if (typeof item === 'number') return { day: item, timeSlot: defaultTimeSlot };
      if (item && typeof item === 'object') {
        return { day: Number(item.day), timeSlot: item.timeSlot || defaultTimeSlot };
      }
      return null;
    })
    .filter((slot) => slot && Number.isInteger(slot.day) && slot.day >= 0 && slot.day <= 6)
    .sort((a, b) => a.day - b.day || a.timeSlot.localeCompare(b.timeSlot));
}

function recentRecordSummary(rows) {
  const byType = new Map();
  for (const row of rows || []) {
    const key = `${row.record_type_id}:${row.record_type_name}`;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push({
      measured_at: toDateText(row.measured_at),
      value: Number(row.value),
      unit: row.unit || '',
      event_name: row.record_type_name || '',
    });
  }
  return [...byType.values()].map((samples) => ({
    event_name: samples[0]?.event_name || '',
    samples,
  }));
}

function contextMessage(student, schedule, recentAttendance) {
  const name = student.name || '학생';
  const scheduleText = schedule.length
    ? schedule.map((slot) => `${slot.weekday} ${slot.time_slot_label}`).join(', ')
    : '등록된 수업 요일 없음';
  const attendedDays = [...new Set(recentAttendance.map((row) => `${row.weekday} ${row.time_slot_label}`))]
    .filter(Boolean)
    .join(', ');
  return `${name} 수업 요일: ${scheduleText}${attendedDays ? `\n최근 출석 기록 요일: ${attendedDays}` : ''}`;
}

function normalizeAttendanceStatus(value) {
  if (value === 'present' || value === 'late' || value === 'absent' || value === 'excused') return value;
  return 'unchecked';
}

function weekdayLabel(value) {
  const text = toDateText(value);
  if (!text) return '';
  const day = new Date(`${text}T00:00:00+09:00`).getDay();
  return WEEKDAY_LABELS[day] || '';
}

function toDateText(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

module.exports = {
  buildStudentContext,
  classSchedule,
};
