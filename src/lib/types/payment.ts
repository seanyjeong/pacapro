/**
 * Payment Type Definitions
 * 학원비 관련 타입 정의
 */

// 기본 학원비 납부 인터페이스
export interface Payment {
  id: number;
  student_id: number;
  student_name: string;
  student_number: string;
  year_month: string; // YYYY-MM
  payment_type: 'monthly' | 'season' | 'material' | 'other';
  base_amount: number; // 기본 금액
  discount_amount: number; // 할인 금액
  additional_amount: number; // 추가 금액
  final_amount: number; // 최종 청구 금액
  paid_amount: number; // 납부 금액
  paid_date?: string; // 납부일 (YYYY-MM-DD)
  due_date: string; // 납부 기한 (YYYY-MM-DD)
  payment_status: 'pending' | 'partial' | 'paid';
  payment_method?: 'account' | 'card' | 'cash' | 'other';
  description?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

// 미납 정보 (연체일수 포함)
export interface UnpaidPayment extends Payment {
  phone?: string;
  parent_phone?: string;
  days_overdue: number;
}

// 학원비 등록/수정용 DTO
export interface PaymentFormData {
  student_id: number;
  payment_type: 'monthly' | 'season' | 'material' | 'other';
  base_amount: number;
  discount_amount?: number;
  additional_amount?: number;
  due_date: string;
  year_month: string; // YYYY-MM
  description?: string;
  notes?: string;
}

// 납부 기록 DTO
export interface PaymentRecordData {
  paid_amount: number;
  payment_method: 'account' | 'card' | 'cash' | 'other';
  payment_date?: string; // 기본값은 오늘
  notes?: string;
  discount_amount?: number; // 추가 할인 금액
}

// 일괄 청구 DTO
export interface BulkMonthlyChargeData {
  year: number;
  month: number;
  due_date: string;
}

// 학원비 필터 인터페이스
export interface PaymentFilters {
  student_id?: number;
  payment_status?: 'pending' | 'partial' | 'paid';
  payment_type?: 'monthly' | 'season' | 'material' | 'other';
  year?: number;
  month?: number;
  search?: string;
}

// 학원비 통계
export interface PaymentStats {
  total_count: number;
  paid_count: number;
  partial_count: number;
  unpaid_count: number;
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
}

// API 응답 타입
export interface PaymentsResponse {
  message: string;
  payments: Payment[];
}

export interface PaymentDetailResponse {
  payment: Payment;
}

export interface PaymentCreateResponse {
  message: string;
  payment: Payment;
}

export interface PaymentUpdateResponse {
  message: string;
  payment: Payment;
}

export interface PaymentDeleteResponse {
  message: string;
  payment: {
    id: number;
    student_name: string;
  };
}

export interface UnpaidPaymentsResponse {
  message: string;
  payments: UnpaidPayment[];
}

export interface BulkChargeResponse {
  message: string;
  created: number;
  updated: number;
  skipped: number;
  withNonSeasonProrated: number;
  withCarryover: number;
  year: number;
  month: number;
  due_date: string;
}

export interface PaymentStatsResponse {
  message: string;
  stats: PaymentStats;
}

// 한글 매핑
export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  monthly: '월 수강료',
  season: '시즌비',
  material: '교재비',
  other: '기타',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '미납',
  partial: '부분납부',
  paid: '완납',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  account: '계좌이체',
  card: '카드',
  cash: '현금',
  other: '기타',
};

// 옵션 리스트
export const PAYMENT_TYPE_OPTIONS = [
  { value: 'monthly', label: '월 수강료' },
  { value: 'season', label: '시즌비' },
  { value: 'material', label: '교재비' },
  { value: 'other', label: '기타' },
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: '미납' },
  { value: 'partial', label: '부분납부' },
  { value: 'paid', label: '완납' },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'account', label: '계좌이체' },
  { value: 'card', label: '카드' },
  { value: 'cash', label: '현금' },
  { value: 'other', label: '기타' },
];
