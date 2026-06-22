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
    activeClassName: 'border-emerald-600 bg-emerald-600 text-white',
    buttonClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  late: {
    value: 'late',
    label: '지각',
    activeClassName: 'border-amber-600 bg-amber-500 text-white',
    buttonClassName: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
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
    activeClassName: 'border-rose-700 bg-rose-600 text-white',
    buttonClassName: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  },
};

export const MOBILE_INSTRUCTOR_MESSAGES = {
  load: '강사 출근 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  save: '강사 출근 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  noSelection: '저장할 출근 상태를 먼저 선택해주세요.',
};
