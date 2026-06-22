import type { Payment } from '@/lib/types/payment';
import { PAYMENT_STATUS_LABELS } from '@/lib/types/payment';
import { calculateOverdueDays, formatPaymentAmount, isOverdue } from '@/lib/utils/payment-helpers';

export function getOutstandingAmount(payment: Payment) {
  return Math.max(0, payment.final_amount - payment.paid_amount);
}

export function getPaymentProgress(payment: Payment) {
  if (payment.final_amount <= 0) return 100;
  return Math.min(100, Math.round((payment.paid_amount / payment.final_amount) * 100));
}

export function getStatusTone(status: Payment['payment_status']) {
  if (status === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

export function getStatusLabel(payment: Payment) {
  const label = PAYMENT_STATUS_LABELS[payment.payment_status];
  if (payment.payment_status !== 'paid' && isOverdue(payment)) {
    return `${label} · ${calculateOverdueDays(payment.due_date)}일 연체`;
  }
  return label;
}

export function getAmountLabel(amount: number) {
  return formatPaymentAmount(amount).replace('₩', '').trim() + '원';
}
