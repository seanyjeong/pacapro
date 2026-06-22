export type ExpenseViewMode = 'list' | 'calendar';

export interface Expense {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  instructor_id?: number;
  instructor_name?: string;
  salary_id?: number;
  description?: string;
  payment_method?: string;
  notes?: string;
}

export interface ExpenseFormData {
  expense_date: string;
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  notes: string;
}

export interface ExpensesResponse {
  expenses?: Expense[];
}

export interface ExpenseSummary {
  totalCount: number;
  totalAmount: number;
  monthlyAverage: number;
  refundPendingCount: number;
  salaryLinkedCount: number;
}

export interface ExpenseSelectOption {
  value: string;
  label: string;
}
