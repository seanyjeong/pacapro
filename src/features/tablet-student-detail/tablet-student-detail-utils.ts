import { formatDateToString } from '@/lib/utils/schedule-helpers';
import type { TabletAttendanceSummary } from './tablet-student-detail-types';

export const TABLET_STUDENT_STATUS_META: Record<string, { label: string; variant: 'success' | 'default' | 'warning' | 'secondary' | 'destructive' }> = {
  active: { label: '재원', variant: 'success' },
  graduated: { label: '졸업', variant: 'default' },
  paused: { label: '휴원', variant: 'warning' },
  pending: { label: '대기', variant: 'secondary' },
  trial: { label: '체험', variant: 'default' },
  withdrawn: { label: '퇴원', variant: 'destructive' },
};

export function getCurrentMonthRange(): { end: string; start: string } {
  const today = new Date();
  return {
    end: formatDateToString(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    start: formatDateToString(new Date(today.getFullYear(), today.getMonth(), 1)),
  };
}

export function formatTabletEnrollmentDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR');
}

export function calculateTabletAttendanceSummary(
  schedules: Array<{ attendances?: Array<{ attendance_status: string | null; student_id: number }> }>,
  studentId: number
): TabletAttendanceSummary {
  let total = 0;
  let present = 0;
  let absent = 0;

  schedules.forEach((schedule) => {
    (schedule.attendances || []).forEach((attendance) => {
      if (attendance.student_id !== studentId) return;
      total += 1;
      if (attendance.attendance_status === 'present' || attendance.attendance_status === 'late') present += 1;
      if (attendance.attendance_status === 'absent') absent += 1;
    });
  });

  return {
    absent,
    present,
    rate: total > 0 ? Math.round((present / total) * 100) : 0,
    total,
  };
}
