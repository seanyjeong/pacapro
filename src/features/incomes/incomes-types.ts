export type IncomeTab = 'all' | 'tuition' | 'other';
export type IncomeViewMode = 'list' | 'calendar';

export interface OtherIncome {
  id: number;
  income_date: string;
  category: string;
  amount: number;
  student_id?: number;
  student_name?: string;
  description?: string;
  payment_method?: string;
  notes?: string;
}

export interface TuitionPayment {
  id: number;
  student_id: number;
  student_name: string;
  year_month: string;
  final_amount: number;
  paid_amount: number;
  paid_date: string;
  payment_method: string;
  payment_status: string;
}

export interface IncomeFormData {
  income_date: string;
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  notes: string;
}

export interface OtherIncomesResponse {
  incomes?: OtherIncome[];
}

export interface TuitionPaymentsResponse {
  payments?: TuitionPayment[];
}

export interface IncomeSummary {
  totalIncome: number;
  totalTuition: number;
  totalOther: number;
  tuitionCount: number;
  otherCount: number;
  tuitionRatio: number;
  otherRatio: number;
}

export interface IncomeSelectOption {
  value: string;
  label: string;
}
