import type { MobileInstructorAttendanceStatus, SlotOption, StatusOption } from './mobile-instructor-types';

export const MOBILE_INSTRUCTOR_TIME_SLOTS: SlotOption[] = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

export const MOBILE_INSTRUCTOR_STATUSES: MobileInstructorAttendanceStatus[] = [
  'present',
  'late',
  'half_day',
  'absent',
];

export const MOBILE_INSTRUCTOR_STATUS_META: Record<MobileInstructorAttendanceStatus, StatusOption> = {
  present: {
    value: 'present',
    label: '출근',
    activeClassName: 'border-success bg-success text-white',
    buttonClassName: 'border-success/30 bg-success-soft text-success',
    badgeClassName: 'border-success/30 bg-success-soft text-success',
  },
  late: {
    value: 'late',
    label: '지각',
    activeClassName: 'border-warning bg-warning text-white',
    buttonClassName: 'border-warning/30 bg-warning-soft text-warning',
    badgeClassName: 'border-warning/30 bg-warning-soft text-warning',
  },
  half_day: {
    value: 'half_day',
    label: '반차',
    activeClassName: 'border-sky-700 bg-sky-600 text-white',
    buttonClassName: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  },
  absent: {
    value: 'absent',
    label: '결근',
    activeClassName: 'border-destructive bg-destructive text-white',
    buttonClassName: 'border-destructive/30 bg-destructive-soft text-destructive',
    badgeClassName: 'border-destructive/30 bg-destructive-soft text-destructive',
  },
};

export const MOBILE_INSTRUCTOR_MESSAGES = {
  load: '강사 출근 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  save: '강사 출근 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  noSelection: '저장할 출근 상태를 먼저 선택해주세요.',
};
