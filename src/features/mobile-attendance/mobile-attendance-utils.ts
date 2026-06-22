import type { AttendanceStatus, TimeSlot } from '@/lib/types/schedule';
import { TIME_SLOT_OPTIONS } from './mobile-attendance-constants';
import type { AttendanceStats, MobileAttendanceSchedule, MobileAttendanceStudent } from './mobile-attendance-types';

export function toLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export function getTimeSlotLabel(timeSlot: TimeSlot) {
  return TIME_SLOT_OPTIONS.find((option) => option.value === timeSlot)?.label || timeSlot;
}

export function normalizeStudents(schedule: MobileAttendanceSchedule | null): MobileAttendanceStudent[] {
  return (schedule?.students || []).map((student) => ({
    ...student,
    grade: student.grade ?? '',
    phone: student.phone ?? null,
    parent_phone: student.parent_phone ?? null,
    is_season_student: Boolean(student.season_type),
    is_makeup: Boolean(student.is_makeup),
  }));
}

export function calculateStats(students: MobileAttendanceStudent[], attendances: Map<number, AttendanceStatus>): AttendanceStats {
  const values = Array.from(attendances.values());
  return {
    total: students.length,
    present: values.filter((status) => status === 'present').length,
    absent: values.filter((status) => status === 'absent').length,
    late: values.filter((status) => status === 'late').length,
    excused: values.filter((status) => status === 'excused').length,
    notMarked: students.length - attendances.size,
  };
}

export function isMarkableStatus(status: AttendanceStatus | null | undefined): status is Exclude<AttendanceStatus, 'makeup' | 'none'> {
  return status === 'present' || status === 'absent' || status === 'late' || status === 'excused';
}
