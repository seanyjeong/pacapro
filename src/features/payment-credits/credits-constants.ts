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
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  partial: 'border-sky-200 bg-sky-50 text-sky-700',
  applied: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  refunded: 'border-violet-200 bg-violet-50 text-violet-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-600',
};

export const CREDIT_TYPE_BADGE_COLORS: Record<Credit['credit_type'], string> = {
  carryover: 'border-blue-200 bg-blue-50 text-blue-700',
  refund: 'border-rose-200 bg-rose-50 text-rose-700',
  manual: 'border-zinc-200 bg-zinc-50 text-zinc-700',
};
