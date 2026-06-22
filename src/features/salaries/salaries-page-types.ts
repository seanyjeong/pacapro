import type { Instructor } from '@/lib/types/instructor';
import type { Salary, SalaryFilters } from '@/lib/types/salary';

export interface SalarySettings {
  salary_payment_day?: number;
  salary_month_type?: 'next' | 'current' | string;
  academy_name?: string;
}

export interface SalarySummary {
  totalCount: number;
  paidCount: number;
  pendingCount: number;
  totalPaid: number;
  totalUnpaid: number;
}

export interface SalaryPageState {
  salaries: Salary[];
  instructors: Instructor[];
  filters: SalaryFilters;
  summary: SalarySummary;
  loading: boolean;
  error: string | null;
  exporting: boolean;
  pdfExporting: boolean;
  pdfProgress: { current: number; total: number };
  bulkPaying: boolean;
  showPasswordModal: boolean;
}
