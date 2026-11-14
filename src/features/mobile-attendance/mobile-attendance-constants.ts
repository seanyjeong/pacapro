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
  { label: string; buttonClassName: string; activeClassName: string; badgeVariant: 'success' | 'warning' | 'destructive' | 'default' }
> = {
  present: {
    label: '출석',
    buttonClassName: 'bg-success-soft text-success',
    activeClassName: 'bg-success text-success-foreground',
    badgeVariant: 'success',
  },
  late: {
    label: '지각',
    buttonClassName: 'bg-warning-soft text-warning',
    activeClassName: 'bg-warning text-warning-foreground',
    badgeVariant: 'warning',
  },
  absent: {
    label: '결석',
    buttonClassName: 'bg-destructive-soft text-destructive',
    activeClassName: 'bg-destructive text-destructive-foreground',
    badgeVariant: 'destructive',
  },
  excused: {
    label: '공결',
    buttonClassName: 'bg-primary-soft text-primary',
    activeClassName: 'bg-primary text-primary-foreground',
    badgeVariant: 'default',
  },
};

export const MARKABLE_STATUSES: MarkableAttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
