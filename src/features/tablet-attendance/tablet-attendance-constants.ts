import type { TabletAttendanceMark, TabletStudentFilter, TabletStatusFilter, TabletTimeSlotOption } from './tablet-attendance-types';

export const TABLET_ATTENDANCE_MESSAGES = {
  load: '출석 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  save: '출석 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  allPresent: '전체 출석 저장을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
} as const;

export const TABLET_TIME_SLOTS: TabletTimeSlotOption[] = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

export const TABLET_STATUS_OPTIONS: { value: TabletStatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'present', label: '출석' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
  { value: 'excused', label: '공결' },
  { value: 'not_marked', label: '미체크' },
];

export const TABLET_STUDENT_TYPE_OPTIONS: { value: TabletStudentFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'regular', label: '일반' },
  { value: 'trial', label: '체험' },
  { value: 'makeup', label: '보충' },
  { value: 'season', label: '시즌' },
];

export const TABLET_ABSENT_REASONS = [
  { value: '개인사정', label: '개인 사정' },
  { value: '무단결석', label: '무단 결석' },
  { value: '기타', label: '기타' },
];

export const TABLET_EXCUSED_REASONS = [
  { value: '질병', label: '질병' },
  { value: '학교시험', label: '학교 시험' },
  { value: '기타', label: '기타' },
];

export const TABLET_MARKS: TabletAttendanceMark[] = ['present', 'late', 'absent', 'excused'];

export const TABLET_STATUS_META: Record<
  TabletAttendanceMark,
  { label: string; activeClassName: string; buttonClassName: string; badgeClassName: string }
> = {
  present: {
    label: '출석',
    activeClassName: 'border-success bg-success text-white',
    buttonClassName: 'border-success/30 bg-success-soft text-success',
    badgeClassName: 'border-success/30 bg-success-soft text-success',
  },
  late: {
    label: '지각',
    activeClassName: 'border-warning bg-warning text-white',
    buttonClassName: 'border-warning/30 bg-warning-soft text-warning',
    badgeClassName: 'border-warning/30 bg-warning-soft text-warning',
  },
  absent: {
    label: '결석',
    activeClassName: 'border-destructive bg-destructive text-white',
    buttonClassName: 'border-destructive/30 bg-destructive-soft text-destructive',
    badgeClassName: 'border-destructive/30 bg-destructive-soft text-destructive',
  },
  excused: {
    label: '공결',
    activeClassName: 'border-sky-600 bg-sky-600 text-white',
    buttonClassName: 'border-sky-200 bg-sky-50 text-sky-700',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700',
  },
};
