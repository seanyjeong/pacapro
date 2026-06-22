import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, REFUND_PENDING_CATEGORY } from './expenses-constants';
import type { Expense, ExpenseFormData, ExpenseSummary } from './expenses-types';

export function formatAmount(amount: number): string {
  return Math.floor(toAmount(amount)).toLocaleString();
}

export function getCurrentYearMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

export function createDefaultExpenseFormData(): ExpenseFormData {
  return {
    expense_date: new Date().toISOString().split('T')[0],
    category: 'utilities',
    amount: 0,
    description: '',
    payment_method: 'account',
    notes: '',
  };
}

export function getMonthRange(yearMonth: string): { startDate: string; endDate: string } {
  const [year, month] = yearMonth.split('-');
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-${lastDay}`,
  };
}

export function toExpenseFormData(expense: Expense): ExpenseFormData {
  return {
    expense_date: expense.expense_date.split('T')[0],
    category: expense.category,
    amount: Math.floor(toAmount(expense.amount)),
    description: expense.description || '',
    payment_method: expense.payment_method || 'account',
    notes: expense.notes || '',
  };
}

export function calculateExpenseSummary(expenses: Expense[]): ExpenseSummary {
  const totalAmount = expenses.reduce((sum, expense) => sum + toAmount(expense.amount), 0);

  return {
    totalCount: expenses.length,
    totalAmount,
    monthlyAverage: expenses.length > 0 ? totalAmount / 12 : 0,
    refundPendingCount: expenses.filter(isRefundPendingExpense).length,
    salaryLinkedCount: expenses.filter((expense) => Boolean(expense.salary_id)).length,
  };
}

export function filterExpenses(expenses: Expense[], query: string): Expense[] {
  const normalizedQuery = query.trim().toLowerCase();

  return expenses
    .filter((expense) => {
      if (!normalizedQuery) return true;
      const categoryLabel = EXPENSE_CATEGORY_LABELS[expense.category] || expense.category;
      const paymentLabel = PAYMENT_METHOD_LABELS[expense.payment_method || 'account'] || '';

      return (
        expense.expense_date?.includes(normalizedQuery) ||
        expense.description?.toLowerCase().includes(normalizedQuery) ||
        expense.instructor_name?.toLowerCase().includes(normalizedQuery) ||
        categoryLabel.toLowerCase().includes(normalizedQuery) ||
        paymentLabel.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));
}

export function isRefundPendingExpense(expense: Expense): boolean {
  return expense.category === REFUND_PENDING_CATEGORY;
}

export function isEditableExpense(expense: Expense): boolean {
  return !expense.salary_id && !isRefundPendingExpense(expense);
}

function toAmount(value: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
}
