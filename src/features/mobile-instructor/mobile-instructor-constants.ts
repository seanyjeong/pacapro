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
    activeClassName: 'bg-success text-success-foreground',
    buttonClassName: 'bg-success-soft text-success',
    badgeVariant: 'success',
  },
  late: {
    value: 'late',
    label: '지각',
    activeClassName: 'bg-warning text-warning-foreground',
    buttonClassName: 'bg-warning-soft text-warning',
    badgeVariant: 'warning',
  },
  half_day: {
    value: 'half_day',
    label: '반차',
    activeClassName: 'bg-primary text-primary-foreground',
    buttonClassName: 'bg-primary-soft text-primary',
    badgeVariant: 'default',
  },
  absent: {
    value: 'absent',
    label: '결근',
    activeClassName: 'bg-destructive text-destructive-foreground',
    buttonClassName: 'bg-destructive-soft text-destructive',
    badgeVariant: 'destructive',
  },
};

export const MOBILE_INSTRUCTOR_MESSAGES = {
  load: '강사 출근 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  save: '강사 출근 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  noSelection: '저장할 출근 상태를 먼저 선택해주세요.',
};
