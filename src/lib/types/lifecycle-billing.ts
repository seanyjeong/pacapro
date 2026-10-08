export type LifecycleBillingAction = 'pause' | 'withdraw';
export type BillingAmount = string | number;
export type LifecycleCreditType = 'none' | 'carryover' | 'refund';

export interface LifecycleBillingSummary {
  original_amount: BillingAmount;
  before_final_amount: BillingAmount;
  prorated_amount: BillingAmount;
  adjusted_amount: BillingAmount;
  paid_amount: BillingAmount;
  outstanding_amount: BillingAmount;
  waived_amount: BillingAmount;
  refundable_amount: BillingAmount;
}

export interface LifecycleBillingRow extends LifecycleBillingSummary {
  requires_payment_review?: boolean;
  payment_id: number;
  year_month: string;
  payment_type: string;
  before_status: string;
  after_status: string;
  days_before: number | null;
  days_month: number | null;
  changed: boolean;
}

export interface LifecycleBillingPreview {
  requires_payment_review?: boolean;
  action: LifecycleBillingAction;
  date: string;
  billing_cutoff_date?: string;
  year_month: string;
  student_id: number;
  days_before: number | null;
  days_month: number | null;
  summary: LifecycleBillingSummary;
  rows: LifecycleBillingRow[];
  requires_confirmation: true;
  readonly: true;
  external_refund_executed: false;
  preview_hash: string;
  credit?: { credit_amount: BillingAmount; remaining_amount: BillingAmount; credit_type: LifecycleCreditType; rest_days: number;
    rest_start_date: string; rest_end_date: string; source_payment_id: number | null; existing?: boolean; id?: number } | null;
}

export interface PauseBillingResult {
  requires_payment_review?: boolean;
  summary?: LifecycleBillingSummary;
  rows?: LifecycleBillingRow[];
  action: 'cancelled' | 'adjusted' | 'unchanged';
  originalAmount: BillingAmount;
  adjustedAmount: BillingAmount;
  message: string;
  paymentIds: number[];
}

export interface WithdrawalBillingResult {
  requires_payment_review?: boolean;
  summary?: LifecycleBillingSummary;
  rows?: LifecycleBillingRow[];
  cancelledPayments: number;
  adjustedPayments: number;
  waivedAmount: BillingAmount;
  paymentIds: number[];
  message: string;
  seasonMessage?: string;
}
