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
  present: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
  absent: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
  late: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
  half_day: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
};

export const INSTRUCTOR_ATTENDANCE_LOAD_ERROR =
  '강사 출근 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export const INSTRUCTOR_ATTENDANCE_SAVE_ERROR =
  '강사 출근 정보를 저장하지 못했습니다. 선택 내용을 확인한 뒤 다시 시도해주세요.';
