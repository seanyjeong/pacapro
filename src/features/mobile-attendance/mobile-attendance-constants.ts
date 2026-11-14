import type { MarkableAttendanceStatus, TimeSlotOption } from './mobile-attendance-types';

export const MOBILE_ATTENDANCE_MESSAGES = {
  load: '출석 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  save: '출석 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  allPresent: '전체 출석 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  noPhone: '등록된 전화번호가 없습니다.',
} as const;

export const TIME_SLOT_OPTIONS: TimeSlotOption[] = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

export const ABSENT_REASONS = [
  { value: '개인사정', label: '개인 사정' },
  { value: '무단결석', label: '무단 결석' },
  { value: '기타', label: '기타' },
];

export const EXCUSED_REASONS = [
  { value: '질병', label: '질병' },
  { value: '학교시험', label: '학교 시험' },
  { value: '기타', label: '기타' },
];

export const STATUS_META: Record<
  MarkableAttendanceStatus,
  { label: string; buttonClassName: string; activeClassName: string; badgeClassName: string }
> = {
  present: {
    label: '출석',
    buttonClassName: 'border-success/30 bg-success-soft text-success',
    activeClassName: 'border-success bg-success text-white',
    badgeClassName: 'border-success/30 bg-success-soft text-success',
  },
  late: {
    label: '지각',
    buttonClassName: 'border-warning/30 bg-warning-soft text-warning',
    activeClassName: 'border-warning bg-warning text-white',
    badgeClassName: 'border-warning/30 bg-warning-soft text-warning',
  },
  absent: {
    label: '결석',
    buttonClassName: 'border-destructive/30 bg-destructive-soft text-destructive',
    activeClassName: 'border-destructive bg-destructive text-white',
    badgeClassName: 'border-destructive/30 bg-destructive-soft text-destructive',
  },
  excused: {
    label: '공결',
    buttonClassName: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300',
    activeClassName: 'border-sky-600 bg-sky-600 text-white dark:border-sky-400',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300',
  },
};

export const MARKABLE_STATUSES: MarkableAttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
