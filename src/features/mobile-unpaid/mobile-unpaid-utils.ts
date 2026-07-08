import type { UnpaidPayment } from '@/lib/types/payment';
import { getRemainingPaymentAmount } from '@/lib/utils/payment-helpers';
import type { MobileUnpaidStats } from './mobile-unpaid-types';

export function toLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getUnpaidAmount(payment: UnpaidPayment) {
  return getRemainingPaymentAmount(payment);
}

export function formatAmount(amount: number | null | undefined) {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '0';
  return new Intl.NumberFormat('ko-KR').format(amount);
}

export function calculateUnpaidStats(payments: UnpaidPayment[]): MobileUnpaidStats {
  return payments.reduce<MobileUnpaidStats>(
    (stats, payment) => ({
      count: stats.count + 1,
      totalUnpaid: stats.totalUnpaid + getUnpaidAmount(payment),
      partialCount: stats.partialCount + (payment.payment_status === 'partial' ? 1 : 0),
      overdueCount: stats.overdueCount + ((payment.days_overdue || 0) > 0 ? 1 : 0),
    }),
    { count: 0, totalUnpaid: 0, partialCount: 0, overdueCount: 0 }
  );
}

export function getOverdueTone(daysOverdue: number) {
  if (daysOverdue >= 30) {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300';
  }
  if (daysOverdue >= 14) {
    return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300';
  }
  if (daysOverdue >= 7) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
  }
  return 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300';
}

export function isEncryptedValue(value: unknown) {
  return typeof value === 'string' && /^ENC:/i.test(value.trim());
}

export function getDisplayStudentName(payment: UnpaidPayment) {
  return isEncryptedValue(payment.student_name) || !payment.student_name ? '학생 정보 확인 필요' : payment.student_name;
}

export function getContactPhone(payment: UnpaidPayment) {
  if (payment.parent_phone && !isEncryptedValue(payment.parent_phone)) return payment.parent_phone;
  if (payment.phone && !isEncryptedValue(payment.phone)) return payment.phone;
  return null;
}

export function filterUnpaidPayments(payments: UnpaidPayment[], query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return payments;
  return payments.filter((payment) => {
    const haystack = [
      getDisplayStudentName(payment),
      payment.student_number,
      payment.year_month,
      getContactPhone(payment),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });
}
