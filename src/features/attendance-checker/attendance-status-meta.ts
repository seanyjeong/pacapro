import type { AttendanceStatus } from '@/lib/types/schedule';

type MarkableStatus = Exclude<AttendanceStatus, 'none'>;

/** 출석 체크 버튼 순서와 색. 누른 상태는 옅은 색 + 같은 색 테두리로 표시한다. */
export const ATTENDANCE_STATUS_BUTTONS: Array<{ status: MarkableStatus; active: string }> = [
  { status: 'present', active: 'bg-success-soft text-success ring-2 ring-inset ring-success/50' },
  { status: 'late', active: 'bg-warning-soft text-warning ring-2 ring-inset ring-warning/50' },
  { status: 'absent', active: 'bg-destructive-soft text-destructive ring-2 ring-inset ring-destructive/50' },
  { status: 'excused', active: 'bg-primary-soft text-primary ring-2 ring-inset ring-primary/50' },
  { status: 'makeup', active: 'bg-card text-foreground ring-2 ring-inset ring-foreground/40' },
];

export const ATTENDANCE_STATUS_BADGE: Record<MarkableStatus, 'success' | 'warning' | 'destructive' | 'default' | 'secondary'> = {
  present: 'success',
  late: 'warning',
  absent: 'destructive',
  excused: 'default',
  makeup: 'secondary',
};
