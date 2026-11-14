import { formatDateToString } from '@/lib/utils/schedule-helpers';
import type { TabletAttendanceSummary } from './tablet-student-detail-types';

export const TABLET_STUDENT_STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: '재원', className: 'bg-success-soft text-success' },
  graduated: { label: '졸업', className: 'bg-primary-soft text-primary' },
  paused: { label: '휴원', className: 'bg-warning-soft text-warning' },
  pending: { label: '대기', className: 'bg-muted text-secondary-foreground' },
  trial: { label: '체험', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  withdrawn: { label: '퇴원', className: 'bg-destructive-soft text-destructive' },
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
