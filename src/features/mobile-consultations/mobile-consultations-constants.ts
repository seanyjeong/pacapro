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
  { label: string; badgeVariant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive'; dotClassName: string }
> = {
  pending: { label: '대기', badgeVariant: 'warning', dotClassName: 'bg-warning' },
  confirmed: { label: '확정', badgeVariant: 'default', dotClassName: 'bg-primary' },
  completed: { label: '완료', badgeVariant: 'secondary', dotClassName: 'bg-muted-foreground/40' },
  cancelled: { label: '취소', badgeVariant: 'secondary', dotClassName: 'bg-muted-foreground/40' },
  no_show: { label: '노쇼', badgeVariant: 'destructive', dotClassName: 'bg-destructive' },
};

export function generateTimeSlots() {
  const slots: string[] = [];
  for (let hour = 9; hour < 18; hour += 1) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
}
