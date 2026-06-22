import { CATEGORY_LABELS } from './incomes-constants';
import type { IncomeFormData, IncomeSummary, OtherIncome, TuitionPayment } from './incomes-types';

export function formatAmount(amount: number): string {
  return Math.floor(toAmount(amount)).toLocaleString();
}

export function getCurrentYearMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

export function createDefaultIncomeFormData(): IncomeFormData {
  return {
    income_date: new Date().toISOString().split('T')[0],
    category: 'other',
    amount: 0,
    description: '',
    payment_method: 'cash',
    notes: '',
  };
}

export function getMonthRange(yearMonth: string): { year: string; month: string; startDate: string; endDate: string } {
  const [year, month] = yearMonth.split('-');
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    year,
    month,
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-${lastDay}`,
  };
}

export function toIncomeFormData(income: OtherIncome): IncomeFormData {
  return {
    income_date: income.income_date.split('T')[0],
    category: income.category,
    amount: Math.floor(toAmount(income.amount)),
    description: income.description || '',
    payment_method: income.payment_method || 'cash',
    notes: income.notes || '',
  };
}

export function filterTuitionPayments(payments: TuitionPayment[], query: string): TuitionPayment[] {
  const normalizedQuery = query.trim().toLowerCase();
  return payments
    .filter((payment) => {
      if (!normalizedQuery) return true;
      return (
        payment.student_name?.toLowerCase().includes(normalizedQuery) ||
        payment.year_month?.includes(normalizedQuery) ||
        payment.paid_date?.includes(normalizedQuery)
      );
    })
    .sort((a, b) => (b.paid_date || '').localeCompare(a.paid_date || ''));
}

export function filterOtherIncomes(incomes: OtherIncome[], query: string): OtherIncome[] {
  const normalizedQuery = query.trim().toLowerCase();
  return incomes
    .filter((income) => {
      if (!normalizedQuery) return true;
      const categoryLabel = CATEGORY_LABELS[income.category] || income.category;
      return (
        income.description?.toLowerCase().includes(normalizedQuery) ||
        income.income_date?.includes(normalizedQuery) ||
        categoryLabel.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((a, b) => (b.income_date || '').localeCompare(a.income_date || ''));
}

export function calculateIncomeSummary(
  tuitionPayments: TuitionPayment[],
  otherIncomes: OtherIncome[]
): IncomeSummary {
  const totalTuition = tuitionPayments.reduce((sum, payment) => sum + toAmount(payment.final_amount), 0);
  const totalOther = otherIncomes.reduce((sum, income) => sum + toAmount(income.amount), 0);
  const totalIncome = totalTuition + totalOther;
  return {
    totalIncome,
    totalTuition,
    totalOther,
    tuitionCount: tuitionPayments.length,
    otherCount: otherIncomes.length,
    tuitionRatio: totalIncome > 0 ? Math.round((totalTuition / totalIncome) * 100) : 0,
    otherRatio: totalIncome > 0 ? Math.round((totalOther / totalIncome) * 100) : 0,
  };
}

function toAmount(value: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
}
