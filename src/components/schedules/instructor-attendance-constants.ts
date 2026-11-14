import type { TimeSlot } from '@/lib/types/schedule';
import type { InstructorAttendanceStatus } from './instructor-attendance-types';

export const INSTRUCTOR_ATTENDANCE_STATUSES: InstructorAttendanceStatus[] = [
  'present',
  'late',
  'absent',
  'half_day',
];

export const INSTRUCTOR_ATTENDANCE_TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export const INSTRUCTOR_ATTENDANCE_STATUS_LABELS: Record<InstructorAttendanceStatus, string> = {
  present: '출근',
  absent: '결근',
  late: '지각',
  half_day: '반차',
};

export const INSTRUCTOR_ATTENDANCE_STATUS_COLORS: Record<InstructorAttendanceStatus, string> = {
  present: 'bg-success-soft text-success border-success/30',
  absent: 'bg-destructive-soft text-destructive border-destructive/30',
  late: 'bg-warning-soft text-warning border-warning/30',
  half_day: 'bg-primary-soft text-primary border-primary/30',
};

export const INSTRUCTOR_ATTENDANCE_LOAD_ERROR =
  '강사 출근 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export const INSTRUCTOR_ATTENDANCE_SAVE_ERROR =
  '강사 출근 정보를 저장하지 못했습니다. 선택 내용을 확인한 뒤 다시 시도해주세요.';
