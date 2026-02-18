/**
 * Payment Type Definitions
 * Aligned with FastAPI backend (api/app/routers/academy/payments)
 */

// ===== Base Payment =====

export interface Payment {
  id: number;
  academy_id: number;
  student_id: number;
  student_name?: string; // attached via backend JOIN
  year_month: string; // "YYYY-MM"
  base_amount: number;
  discount_amount: number;
  final_amount: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_date: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'account' | 'card' | 'cash' | 'other';

// ===== Request DTOs =====

export interface PaymentFormData {
  student_id: number;
  year_month: string;
  base_amount: number;
  discount_amount?: number;
  final_amount?: number;
  due_date?: string;
  notes?: string;
}

export interface PaymentRecordData {
  paid_amount: number;
  payment_method: PaymentMethod;
  paid_date?: string;
  notes?: string;
}

export interface BulkMonthlyChargeData {
  year_month: string; // "YYYY-MM"
  overwrite?: boolean;
}

export interface PaymentFilters {
  student_id?: number;
  payment_status?: PaymentStatus;
  year_month?: string;
  search?: string; // client-side filter only
}

// ===== Response Types (backend returns flat, no wrapper) =====

// GET /payments → Payment[] directly
// GET /payments/unpaid → Payment[] directly (with student_name)
// GET /payments/unpaid-today → Payment[] directly
// GET /payments/{id} → Payment directly
// POST /payments → Payment directly
// PUT /payments/{id} → Payment directly
// DELETE /payments/{id} → { message: string }
// POST /payments/{id}/pay → Payment directly

export interface BulkChargeResponse {
  year_month: string;
  created_count: number;
  student_ids: number[];
}

export interface PaymentStatsResponse {
  total_billed: number;
  total_paid: number;
  total_unpaid: number;
  paid_count: number;
  unpaid_count: number;
  partial_count: number;
  collection_rate: number;
}

export interface PaymentHistoryResponse {
  student_id: number;
  payments: Payment[];
  summary: {
    total_billed: number;
    total_paid: number;
    balance: number;
  };
}

// ===== Prepaid =====

export interface PrepaidPreviewRequest {
  student_id: number;
  months: number; // int, not string[]
}

export interface PrepaidPreviewResponse {
  student_id: number;
  months: number;
  monthly_tuition: number;
  total_without_discount: number;
  discount_rate: number;
  discount_amount: number;
  final_amount: number;
}

export interface PrepaidPayRequest {
  student_id: number;
  months: number; // int, not string[]
  amount: number;
}

export interface PrepaidPayResponse {
  student_id: number;
  months: number;
  total_amount: number;
  payment_ids: number[];
}

export interface PrepaidBalanceResponse {
  student_id: number;
  total_billed: number;
  total_paid: number;
  prepaid_balance: number;
  outstanding: number;
}

// ===== Credits =====

// GET /payments/credits → Payment[] directly (discount_amount > 0)
export interface CreditsSummaryResponse {
  total_credits: number;
  total_saved: number;
}

// ===== Labels & Options =====

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '미납',
  partial: '부분납부',
  paid: '완납',
  overdue: '연체',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  account: '계좌이체',
  card: '카드',
  cash: '현금',
  other: '기타',
};

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: '미납' },
  { value: 'partial', label: '부분납부' },
  { value: 'paid', label: '완납' },
  { value: 'overdue', label: '연체' },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'account', label: '계좌이체' },
  { value: 'card', label: '카드' },
  { value: 'cash', label: '현금' },
  { value: 'other', label: '기타' },
];
