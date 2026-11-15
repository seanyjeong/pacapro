import type { Payment, PaymentFilters } from '@/lib/types/payment';

export interface CreditStudentInfo {
  studentId: number;
  studentName: string;
  monthlyTuition: number;
  weeklyCount: number;
  classDays: number[];
}

export interface PaymentSummary {
  selectedYearMonth: string;
  filteredCount: number;
  currentMonthPayments: Payment[];
  previousUnpaidPayments: Payment[];
  paidCount: number;
  unpaidCount: number;
  unpaidPartialCount: number; // unpaidCount 안에 든 잔액 남은 부분 납부
  partialCount: number;
  unpaidNotifyCount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  paidRate: number;
}

export interface PaymentsPageStateOptions {
  statusFromUrl: string | null;
  viewOnly: boolean;
}

export type PaymentStatusFilter = PaymentFilters['payment_status'];
export type PaymentTypeFilter = PaymentFilters['payment_type'];
