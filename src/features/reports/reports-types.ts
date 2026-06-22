import type { Expense } from '@/features/expenses/expenses-types';
import type { OtherIncome } from '@/features/incomes/incomes-types';
import type { Instructor } from '@/lib/types/instructor';
import type { Payment } from '@/lib/types/payment';
import type { Student } from '@/lib/types/student';

export type ReportExportType = 'revenue' | 'expenses' | 'financial' | 'payments';

export interface ReportDateRange {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

export interface ReportSourceData {
  students: Student[];
  payments: Payment[];
  paidPayments: Payment[];
  expenses: Expense[];
  instructors: Instructor[];
  otherIncomes: OtherIncome[];
}

export interface ReportStats {
  students: {
    total: number;
    active: number;
    paused: number;
    avgMonthlyTuition: number;
  };
  payments: {
    total: number;
    paid: number;
    unpaid: number;
    totalAmount: number;
    paidAmountFromBilled: number;
    paidAmount: number;
  };
  expenses: {
    total: number;
    totalAmount: number;
  };
  instructors: {
    total: number;
    active: number;
  };
  otherIncomes: {
    total: number;
    totalAmount: number;
  };
}

export interface ReportComputedStats {
  totalIncome: number;
  netProfit: number;
  profitMargin: string;
  collectionRate: number;
  unpaidAmount: number;
}

export interface StudentsReportResponse {
  students?: Student[];
}

export interface PaymentsReportResponse {
  payments?: Payment[];
}

export interface ExpensesReportResponse {
  expenses?: Expense[];
}

export interface InstructorsReportResponse {
  instructors?: Instructor[];
}

export interface IncomesReportResponse {
  incomes?: OtherIncome[];
}
