import type { ConsultationStatus } from '@/lib/types/consultation';

export const MOBILE_CONSULTATION_MESSAGES = {
  load: '상담 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  bookedTimes: '예약된 시간을 불러오지 못했습니다. 선택 가능한 시간을 다시 확인해주세요.',
  create: '상담 등록을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  status: '상담 상태를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.',
} as const;

export const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export const GRADE_OPTIONS = ['중3', '고1', '고2', '고3', 'N수', '성인'];

export const CONSULTATION_STATUS_ORDER: ConsultationStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
];

export const CONSULTATION_STATUS_META: Record<
  ConsultationStatus,
  { label: string; className: string; dotClassName: string }
> = {
  pending: {
    label: '대기',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    dotClassName: 'bg-amber-500',
  },
  confirmed: {
    label: '확정',
    className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
    dotClassName: 'bg-sky-500',
  },
  completed: {
    label: '완료',
    className: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    dotClassName: 'bg-zinc-400',
  },
  cancelled: {
    label: '취소',
    className: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    dotClassName: 'bg-zinc-400',
  },
  no_show: {
    label: '노쇼',
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
    dotClassName: 'bg-rose-500',
  },
};

export function generateTimeSlots() {
  const slots: string[] = [];
  for (let hour = 9; hour < 18; hour += 1) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
}
