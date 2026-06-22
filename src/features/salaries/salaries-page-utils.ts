import type { Salary, SalaryFilters } from '@/lib/types/salary';
import { calculateTotalPaid, calculateTotalUnpaid } from '@/lib/utils/salary-helpers';
import type { SalarySummary } from './salaries-page-types';

export function calculateDefaultYearMonth(
  _salaryPayDay: number,
  salaryMonthType: 'next' | 'current'
): { year: number; month: number } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (salaryMonthType === 'next') {
    const targetMonth = currentMonth - 1;
    if (targetMonth <= 0) return { year: currentYear - 1, month: 12 };
    return { year: currentYear, month: targetMonth };
  }
  return { year: currentYear, month: currentMonth };
}

export function calculateSalarySummary(salaries: Salary[]): SalarySummary {
  return {
    totalCount: salaries.length,
    paidCount: salaries.filter((salary) => salary.payment_status === 'paid').length,
    pendingCount: salaries.filter((salary) => salary.payment_status === 'pending').length,
    totalPaid: calculateTotalPaid(salaries),
    totalUnpaid: calculateTotalUnpaid(salaries),
  };
}

export function getCurrentFilterYearMonth(filters: SalaryFilters) {
  if (!filters.year || !filters.month) return undefined;
  return `${filters.year}-${String(filters.month).padStart(2, '0')}`;
}

export function formatWon(amount: number) {
  return `${Math.floor(amount || 0).toLocaleString()}원`;
}

export function createDefaultFilters(salaryPayDay: number, salaryMonthType: 'next' | 'current'): SalaryFilters {
  return calculateDefaultYearMonth(salaryPayDay, salaryMonthType);
}
