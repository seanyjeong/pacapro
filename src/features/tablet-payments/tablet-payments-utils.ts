import type { Payment, PaymentFilters } from '@/lib/types/payment';
import { createInitialPaymentFilters, getSelectedYearMonth, toAmount } from '@/features/payments/payments-utils';

export function parseStudentId(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function createTabletPaymentFilters(studentId?: number, statusFromUrl?: string | null): PaymentFilters {
  return {
    ...createInitialPaymentFilters(),
    student_id: studentId,
    payment_status: statusFromUrl === 'unpaid' ? 'pending' : undefined,
  };
}

export function getStudentPaymentTitle(studentId: number | undefined, studentName: string | null): string {
  if (!studentId) return '결제 확인';
  return `${studentName || '선택한 학생'} 결제 확인`;
}

export function filterTabletPayments(payments: Payment[], filters: PaymentFilters): Payment[] {
  const query = filters.search?.trim().toLowerCase();
  if (!query) return payments;
  return payments.filter((payment) => payment.student_name?.toLowerCase().includes(query));
}

export function getRemainingAmount(payment: Payment): number {
  return Math.max(toAmount(payment.final_amount) - toAmount(payment.paid_amount), 0);
}

export function shiftPaymentMonth(filters: PaymentFilters, delta: number): Pick<PaymentFilters, 'year' | 'month'> {
  const selectedYearMonth = getSelectedYearMonth(filters);
  const [year, month] = selectedYearMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function formatKoreanYearMonth(filters: PaymentFilters): string {
  const selectedYearMonth = getSelectedYearMonth(filters);
  const [year, month] = selectedYearMonth.split('-').map(Number);
  return `${year}년 ${month}월`;
}
