import type { Payment } from '@/lib/types/payment';
import { formatPaymentAmount } from '@/lib/utils/payment-helpers';

export function getAmountView(payment: Payment, paidAmount: number, remainingAmount: number) {
  const finalAmount = Number(payment.final_amount) || 0;
  const settledAmount = paidAmount > 0 ? paidAmount : Math.max(finalAmount - remainingAmount, 0);

  if (payment.payment_status === 'paid') {
    return {
      label: '완납 금액',
      amount: paidAmount,
      tone: 'text-emerald-700 dark:text-emerald-300',
      detail: payment.final_amount !== paidAmount ? `총 청구 ${formatPaymentAmount(payment.final_amount)}` : null,
    };
  }

  if ((payment.payment_status === 'partial' || settledAmount > 0) && remainingAmount > 0) {
    return {
      label: '남은 금액',
      amount: remainingAmount,
      tone: 'text-rose-700 dark:text-rose-300',
      detail: settledAmount > 0
        ? `총 청구 ${formatPaymentAmount(payment.final_amount)} · 납부 ${formatPaymentAmount(settledAmount)}`
        : `총 청구 ${formatPaymentAmount(payment.final_amount)} · 납부액 확인 필요`,
    };
  }

  return {
    label: '청구 금액',
    amount: payment.final_amount,
    tone: 'text-foreground',
    detail: null,
  };
}
