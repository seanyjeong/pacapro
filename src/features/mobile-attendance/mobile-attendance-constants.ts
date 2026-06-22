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
    buttonClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
    activeClassName: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  late: {
    label: '지각',
    buttonClassName: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
    activeClassName: 'border-amber-600 bg-amber-500 text-white dark:border-amber-400',
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  },
  absent: {
    label: '결석',
    buttonClassName: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300',
    activeClassName: 'border-rose-600 bg-rose-600 text-white dark:border-rose-400',
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300',
  },
  excused: {
    label: '공결',
    buttonClassName: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300',
    activeClassName: 'border-sky-600 bg-sky-600 text-white dark:border-sky-400',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300',
  },
};

export const MARKABLE_STATUSES: MarkableAttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
