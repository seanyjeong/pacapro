import type { AttendanceStatus, TimeSlot } from '@/lib/types/schedule';
import type { TabletAttendanceFilters, TabletAttendanceStats, TabletAttendanceStudent } from './tablet-attendance-types';
import { TABLET_TIME_SLOTS } from './tablet-attendance-constants';

export function toLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return toLocalDateStr(next);
}

export function formatTabletDate(date: string) {
  const current = new Date(`${date}T00:00:00`);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${current.getMonth() + 1}월 ${current.getDate()}일 (${days[current.getDay()]})`;
}

export function getTimeSlotLabel(timeSlot: TimeSlot) {
  return TABLET_TIME_SLOTS.find((slot) => slot.value === timeSlot)?.label || timeSlot;
}

export function isMarkableStatus(status: AttendanceStatus | null | undefined): status is Exclude<AttendanceStatus, 'makeup' | 'none'> {
  return status === 'present' || status === 'late' || status === 'absent' || status === 'excused';
}

export function calculateTabletStats(students: TabletAttendanceStudent[]): TabletAttendanceStats {
  return students.reduce(
    (acc, student) => {
      if (student.attendance_status === 'present') acc.present += 1;
      else if (student.attendance_status === 'late') acc.late += 1;
      else if (student.attendance_status === 'absent') acc.absent += 1;
      else if (student.attendance_status === 'excused') acc.excused += 1;
      else acc.notMarked += 1;
      return acc;
    },
    { total: students.length, present: 0, absent: 0, late: 0, excused: 0, notMarked: 0 }
  );
}

export function filterTabletStudents(students: TabletAttendanceStudent[], filters: TabletAttendanceFilters) {
  const query = filters.query.trim().toLowerCase();
  return students.filter((student) => {
    if (query && !student.student_name.toLowerCase().includes(query)) return false;
    if (filters.status !== 'all') {
      if (filters.status === 'not_marked') {
        if (student.attendance_status !== null) return false;
      } else if (student.attendance_status !== filters.status) {
        return false;
      }
    }

    if (filters.studentType === 'trial' && !student.is_trial) return false;
    if (filters.studentType === 'makeup' && !student.is_makeup) return false;
    if (filters.studentType === 'season' && !student.season_type) return false;
    if (filters.studentType === 'regular' && (student.is_trial || student.is_makeup || student.season_type)) return false;
    return true;
  });
}
