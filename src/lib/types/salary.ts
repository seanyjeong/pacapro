/**
 * Salary Type Definitions
 * Aligned with FastAPI backend (api/app/routers/academy/salaries)
 */

// ===== Base Salary =====

export type TaxType = '3.3%' | 'insurance' | 'none';

export interface Salary {
  id: number;
  academy_id: number;
  instructor_id: number;
  instructor_name?: string; // attached via backend JOIN when available
  year_month: string; // "YYYY-MM"
  base_salary: number;
  overtime_pay: number;
  incentive: number;
  tax_type: TaxType; // snapshot from instructor at calculation time
  tax_amount: number; // auto-calculated; editable for insurance type
  deductions: number;
  total_salary: number; // gross - tax_amount - deductions
  paid_amount: number;
  payment_status: SalaryPaymentStatus;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export type SalaryPaymentStatus = 'unpaid' | 'partial' | 'paid';

// ===== Request DTOs =====

export interface SalaryFormData {
  instructor_id: number;
  year_month: string;
  base_salary?: number;
  overtime_pay?: number;
  incentive?: number;
  tax_type?: TaxType;
  tax_amount?: number;
  deductions?: number;
  total_salary?: number;
  notes?: string;
}

export interface SalaryCalculateRequest {
  instructor_id: number;
  year_month: string;
}

export interface BulkPayRequest {
  salary_ids: number[];
  paid_date: string;
  payment_method?: string;
}

export interface SalaryFilters {
  instructor_id?: number;
  year_month?: string;
  payment_status?: SalaryPaymentStatus;
}

// ===== Response Types (backend returns flat, no wrapper) =====

// GET /salaries → Salary[] directly
// GET /salaries/{id} → Salary directly
// POST /salaries → Salary directly
// POST /salaries/calculate → Salary directly (creates record)
// POST /salaries/recalculate/{id} → Salary directly
// PUT /salaries/{id} → Salary directly
// DELETE /salaries/{id} → { message: string }
// POST /salaries/{id}/pay → Salary directly
// POST /salaries/bulk-pay → { message: string, updated_ids: number[] }

export interface SalarySummaryResponse {
  year_month: string;
  total_records: number;
  total_salary: number;
  total_paid: number;
  total_unpaid: number;
  unpaid_count: number;
  partial_count: number;
  paid_count: number;
}

export interface WorkSummaryResponse {
  instructor_id: number;
  instructor_name: string;
  year_month: string;
  total_classes: number;
  morning_classes: number;
  afternoon_classes: number;
  evening_classes: number;
  overtime_count: number;
  overtime_hours: number;
  work_days: number;
}

// ===== Labels & Options =====

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  '3.3%': '3.3%',
  insurance: '4대보험',
  none: '없음',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '미지급',
  partial: '부분지급',
  paid: '지급완료',
};

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: '미지급' },
  { value: 'partial', label: '부분지급' },
  { value: 'paid', label: '지급완료' },
];
