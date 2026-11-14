import type { Payment } from '@/lib/types/payment';
import { PAYMENT_STATUS_LABELS } from '@/lib/types/payment';
import {
  calculateOverdueDays,
  formatPaymentAmount,
  getPaidPaymentAmount,
  getRemainingPaymentAmount,
  isOverdue,
} from '@/lib/utils/payment-helpers';

export function getOutstandingAmount(payment: Payment) {
  return getRemainingPaymentAmount(payment);
}

export function getSettledAmount(payment: Payment) {
  return getPaidPaymentAmount(payment);
}

export function getPaymentProgress(payment: Payment) {
  if (payment.final_amount <= 0) return 100;
  return Math.min(100, Math.round((getSettledAmount(payment) / payment.final_amount) * 100));
}

export function getStatusTone(status: Payment['payment_status']) {
  if (status === 'paid') return 'border-success/30 bg-success-soft text-success';
  if (status === 'partial') return 'border-warning/30 bg-warning-soft text-warning';
  return 'border-destructive/30 bg-destructive-soft text-destructive';
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
