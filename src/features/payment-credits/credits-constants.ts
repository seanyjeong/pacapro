import type { Credit } from '@/lib/types/payment';

export const CREDIT_TYPE_LABELS: Record<Credit['credit_type'], string> = {
  carryover: '이월',
  refund: '환불',
  manual: '수동',
};

export const CREDIT_STATUS_LABELS: Record<Credit['status'], string> = {
  pending: '대기',
  partial: '부분적용',
  applied: '적용완료',
  refunded: '환불',
  cancelled: '취소',
};

export const CREDIT_STATUS_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'pending', label: CREDIT_STATUS_LABELS.pending },
  { value: 'partial', label: CREDIT_STATUS_LABELS.partial },
  { value: 'applied', label: CREDIT_STATUS_LABELS.applied },
  { value: 'refunded', label: CREDIT_STATUS_LABELS.refunded },
  { value: 'cancelled', label: CREDIT_STATUS_LABELS.cancelled },
] as const;

export const CREDIT_TYPE_OPTIONS = [
  { value: 'all', label: '전체 타입' },
  { value: 'carryover', label: CREDIT_TYPE_LABELS.carryover },
  { value: 'refund', label: CREDIT_TYPE_LABELS.refund },
  { value: 'manual', label: CREDIT_TYPE_LABELS.manual },
] as const;

export const CREDIT_STATUS_BADGE_COLORS: Record<Credit['status'], string> = {
  pending: 'border-warning/30 bg-warning-soft text-warning',
  partial: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  applied: 'border-success/30 bg-success-soft text-success',
  refunded: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  cancelled: 'border-border bg-muted text-secondary-foreground',
};

export const CREDIT_TYPE_BADGE_COLORS: Record<Credit['credit_type'], string> = {
  carryover: 'border-primary/30 bg-primary-soft text-primary',
  refund: 'border-destructive/30 bg-destructive-soft text-destructive',
  manual: 'border-border bg-muted text-secondary-foreground',
};
