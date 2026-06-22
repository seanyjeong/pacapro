import type { Payment, PaymentFilters } from '@/lib/types/payment';
import { parseClassDays } from '@/lib/types/student';
import type { ClassDaysResponse } from '@/lib/types/student';
import type { CreditStudentInfo, PaymentSummary } from './payments-types';

export function getCurrentYearMonth(): { year: number; month: number; yearMonth: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return { year, month, yearMonth: `${year}-${String(month).padStart(2, '0')}` };
}

export function createInitialPaymentFilters(): PaymentFilters {
  const current = getCurrentYearMonth();
  return {
    year: current.year,
    month: current.month,
    include_previous_unpaid: true,
  };
}

export function getSelectedYearMonth(filters: PaymentFilters): string {
  const current = getCurrentYearMonth();
  if (!filters.year || !filters.month) return current.yearMonth;
  return `${filters.year}-${String(filters.month).padStart(2, '0')}`;
}

export function createClassDaysMap(response: ClassDaysResponse): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const student of response.students || []) {
    map.set(student.id, parseClassDays(student.class_days || []));
  }
  return map;
}

export function filterPayments(
  payments: Payment[],
  filters: PaymentFilters,
  viewOnly: boolean,
  todayUnpaidOnly: boolean,
  studentClassDaysMap: Map<number, number[]>
): Payment[] {
  const query = filters.search?.trim().toLowerCase();
  const todayDayOfWeek = new Date().getDay();

  return payments.filter((payment) => {
    if (viewOnly && payment.payment_status === 'paid') return false;
    if (query && !payment.student_name?.toLowerCase().includes(query)) return false;
    if (!todayUnpaidOnly) return true;
    if (payment.payment_status === 'paid') return false;
    const days = studentClassDaysMap.get(payment.student_id);
    return Boolean(days?.includes(todayDayOfWeek));
  });
}

export function calculatePaymentSummary(payments: Payment[], selectedYearMonth: string): PaymentSummary {
  const currentMonthPayments = payments.filter((payment) => payment.year_month === selectedYearMonth);
  const previousUnpaidPayments = payments.filter((payment) => payment.year_month !== selectedYearMonth);
  const paidCount = currentMonthPayments.filter((payment) => payment.payment_status === 'paid').length;
  const unpaidCount = currentMonthPayments.filter((payment) => payment.payment_status === 'pending').length;
  const partialCount = currentMonthPayments.filter((payment) => payment.payment_status === 'partial').length;
  const totalAmount = Math.floor(currentMonthPayments.reduce((sum, payment) => sum + toAmount(payment.final_amount), 0));
  const paidAmount = Math.floor(
    currentMonthPayments
      .filter((payment) => payment.payment_status === 'paid')
      .reduce((sum, payment) => sum + toAmount(payment.final_amount), 0)
  );
  const unpaidAmount = Math.floor(
    currentMonthPayments
      .filter((payment) => payment.payment_status !== 'paid')
      .reduce((sum, payment) => sum + toAmount(payment.final_amount) - toAmount(payment.paid_amount || 0), 0)
  );

  return {
    selectedYearMonth,
    filteredCount: payments.length,
    currentMonthPayments,
    previousUnpaidPayments,
    paidCount,
    unpaidCount,
    partialCount,
    totalAmount,
    paidAmount,
    unpaidAmount,
    paidRate: payments.length > 0 ? Math.round((paidCount / payments.length) * 100) : 0,
  };
}

export function toCreditStudentInfo(payment: Payment, monthlyTuition: number, weeklyCount: number, classDays: number[]): CreditStudentInfo {
  return {
    studentId: payment.student_id,
    studentName: payment.student_name,
    monthlyTuition,
    weeklyCount,
    classDays,
  };
}

export function toAmount(value: number | string | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
