/**
 * 시즌 관리 타입 정의
 * 수시/정시 시즌, 학생 시즌등록, 일할계산 관련
 */

// 시즌 타입 (수시/정시) - frontend-only concept
export type SeasonType = 'early' | 'regular';

// 시즌 상태 (backend: active | completed | cancelled)
export type SeasonStatus = 'active' | 'completed' | 'cancelled';

// 연속등록 할인 타입 - frontend-only concept
export type ContinuousDiscountType = 'none' | 'free' | 'rate';

// 시간대 타입 - frontend-only concept for season
export type TimeSlot = 'morning' | 'afternoon' | 'evening';

// 학년별 시간대 설정 (다중 선택 가능)
export interface GradeTimeSlots {
  [grade: string]: TimeSlot[];
}

// 시즌 대상 학년 (고3, N수만 시즌 사용)
export const SEASON_TARGET_GRADES = ['고3', 'N수'] as const;
export type SeasonTargetGrade = typeof SEASON_TARGET_GRADES[number];

// 학생 시즌등록 상태 (backend: enrolled | cancelled | completed)
export type StudentSeasonStatus = 'enrolled' | 'cancelled' | 'completed';

// 납부 상태 (backend default: unpaid)
export type PaymentStatus = 'unpaid' | 'paid' | 'partial' | 'cancelled';

// 시즌 인터페이스 (backend fields primary)
export interface Season {
  id: number;
  academy_id: number;
  // Backend fields
  name: string;
  start_date: string;
  end_date: string;
  fee: number;
  description?: string | null;
  status: SeasonStatus;
  created_at: string;
  // Frontend aliases (populated by mapSeason)
  season_name?: string;
  season_start_date?: string;
  season_end_date?: string;
  default_season_fee?: string;
  // Frontend-only fields (not in backend DB)
  season_type?: SeasonType;
  non_season_end_date?: string | null;
  operating_days?: number[] | string;
  grade_time_slots?: GradeTimeSlots | string | null;
  allows_continuous?: boolean;
  continuous_to_season_type?: SeasonType | null;
  continuous_discount_type?: ContinuousDiscountType;
  continuous_discount_rate?: number;
  updated_at?: string;
}

// 시즌 생성/수정용 폼 데이터 (frontend form, superset of backend)
export interface SeasonFormData {
  season_name: string;
  season_type: SeasonType;
  year: number;
  start_date: string;
  end_date: string;
  non_season_end_date?: string;
  operating_days: number[];
  grade_time_slots?: GradeTimeSlots;
  season_fee: number;
  continuous_discount_type?: ContinuousDiscountType;
  continuous_discount_rate?: number;
  status?: SeasonStatus;
  notes?: string;
}

// 시즌 필터
export interface SeasonFilters {
  year?: number;
  season_type?: SeasonType;
  status?: SeasonStatus;
}

// 학생 시즌 등록 정보 (backend fields primary)
export interface StudentSeason {
  id: number;
  student_id: number;
  season_id: number;
  academy_id?: number;
  // Backend fields
  enrollment_date: string;
  fee: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  status: StudentSeasonStatus;
  created_at: string;
  // Join field (from student history endpoint: {...studentSeason, season: {...}})
  season?: Season;
  // Frontend aliases (populated by mapStudentSeason)
  season_name?: string;
  student_name?: string;
  student_number?: string;
  student_grade?: string;
  season_fee?: string;
  registration_date?: string | null;
  registered_at?: string;
  // Frontend-only fields (not in backend DB)
  prorated_month?: string | null;
  prorated_amount?: string | null;
  prorated_details?: ProRatedDetails | null;
  is_continuous?: boolean;
  previous_season_id?: number | null;
  discount_type?: ContinuousDiscountType | 'custom' | null;
  discount_amount?: string | null;
  final_fee?: string;
  notes?: string | null;
  time_slots?: TimeSlot[] | string;
}

// 일할계산 상세 정보
export interface ProRatedDetails {
  total_days: number;
  pro_rated_days: number;
  daily_rate: number;
  original_monthly: number;
  discount_rate: number;
  final_amount: number;
  calculation_method: string;
}

// 시즌 등록 요청 데이터 (matches backend SeasonEnroll + frontend extras)
export interface SeasonEnrollData {
  student_id: number;
  fee?: number;
  enrollment_date?: string;
  // Frontend-only fields (sent to backend, extra fields ignored by Pydantic)
  time_slots?: TimeSlot[];
  discount_amount?: number;
  is_continuous?: boolean;
  previous_season_id?: number;
}

// 시즌 등록 수정 데이터 (matches backend EnrollmentUpdate + frontend extras)
export interface EnrollmentUpdateData {
  paid_amount?: number;
  payment_status?: string;
  status?: string;
  // Frontend-only fields (sent to backend, extra fields ignored by Pydantic)
  time_slots?: TimeSlot[] | string;
  registration_date?: string;
  season_fee?: number;
  discount_amount?: number;
  discount_reason?: string;
}

// 대량 등록 데이터 (matches backend BulkEnroll)
export interface BulkEnrollData {
  student_ids: number[];
  fee?: number;
}

// 시즌 미리보기 응답 (backend: GET /seasons/{id}/preview)
export interface SeasonPreviewResponse {
  season: Season;
  stats: {
    total_enrollments: number;
    enrolled: number;
    cancelled: number;
    completed: number;
    total_fee: number;
    total_paid: number;
    collection_rate: number;
  };
}

// 환불 미리보기 응답 (backend: POST /enrollments/{id}/refund-preview)
export interface RefundPreviewResponse {
  enrollment_id: number;
  fee: number;
  paid_amount: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
  refund_ratio: number;
  refund_amount: number;
}

// 시즌 중간 합류 일할계산 정보 (frontend-only)
export interface MidSeasonProRated {
  is_mid_season: boolean;
  original_fee: number;
  prorated_fee: number;
  discount: number;
  total_days: number;
  remaining_days: number;
  details: string;
}

// 일할계산 미리보기 (frontend-only, for future backend expansion)
export interface ProRatedPreview {
  student: {
    id: number;
    name: string;
    student_number: string;
    class_days: number[];
    monthly_tuition: string;
    discount_rate: string;
  };
  season: {
    id: number;
    season_name: string;
    start_date: string;
    end_date: string;
    non_season_end_date: string | null;
    season_fee: string;
  };
  prorated: {
    total_days: number;
    pro_rated_days: number;
    daily_rate: number;
    original_monthly: number;
    discount_rate: number;
    final_amount: number;
  };
  mid_season_prorated: MidSeasonProRated | null;
  continuous_discount: {
    is_continuous: boolean;
    discount_type: ContinuousDiscountType;
    discount_rate: number;
    discount_amount: number;
  } | null;
  final_calculation: {
    season_fee: number;
    original_season_fee?: number;
    mid_season_discount?: number;
    prorated_fee: number;
    discount_amount: number;
    total_due: number;
  };
  non_season_prorated_info?: {
    amount: number;
    days: number;
    message: string;
  } | null;
}

// 환불 계산 결과 (frontend-only, for future backend expansion)
export interface RefundData {
  paidAmount: number;
  originalFee: number;
  discountAmount: number;
  totalClassDays: number;
  attendedDays: number;
  remainingDays: number;
  progressRate: string;
  usedAmount: number;
  usedRate: string;
  refundAmount: number;
  refundRate: string;
  includeVat: boolean;
  vatAmount: number;
  refundAfterVat: number;
  legalRefundRate: string;
  legalRefundReason: string;
  legalRefundAmount: number;
  finalRefundAmount: number;
  calculationDetails: {
    paidAmount: string;
    perClassFee: string;
    usedFormula: string;
    refundFormula: string;
    vatFormula: string | null;
  };
}

// 레이블 매핑
export const SEASON_TYPE_LABELS: Record<SeasonType, string> = {
  early: '수시',
  regular: '정시',
};

export const SEASON_STATUS_LABELS: Record<SeasonStatus, string> = {
  active: '진행중',
  completed: '종료',
  cancelled: '취소',
};

export const CONTINUOUS_DISCOUNT_TYPE_LABELS: Record<ContinuousDiscountType, string> = {
  none: '없음',
  free: '무료',
  rate: '할인율',
};

export const STUDENT_SEASON_STATUS_LABELS: Record<StudentSeasonStatus, string> = {
  enrolled: '등록완료',
  cancelled: '취소',
  completed: '수강완료',
};

// 옵션 데이터
export const SEASON_TYPE_OPTIONS = [
  { value: 'early' as SeasonType, label: '수시' },
  { value: 'regular' as SeasonType, label: '정시' },
];

export const SEASON_STATUS_OPTIONS = [
  { value: 'active' as SeasonStatus, label: '진행중' },
  { value: 'completed' as SeasonStatus, label: '종료' },
  { value: 'cancelled' as SeasonStatus, label: '취소' },
];

export const CONTINUOUS_DISCOUNT_OPTIONS = [
  { value: 'none' as ContinuousDiscountType, label: '없음' },
  { value: 'free' as ContinuousDiscountType, label: '무료' },
  { value: 'rate' as ContinuousDiscountType, label: '할인율 적용' },
];

// 요일 옵션 (체크박스용)
export const OPERATING_DAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

// 시간대 옵션
export const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

// 시간대 레이블
export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};

// 유틸리티 함수
export function formatSeasonFee(fee: string | number | null | undefined): string {
  if (fee === null || fee === undefined || fee === '') return '0원';
  const num = typeof fee === 'string' ? parseFloat(fee) : fee;
  if (isNaN(num)) return '0원';
  return new Intl.NumberFormat('ko-KR').format(num) + '원';
}

export function formatOperatingDays(days: number[]): string {
  const dayLabels: Record<number, string> = {
    0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
  };
  return days.map(d => dayLabels[d]).join(', ');
}

export function parseOperatingDays(days: number[] | string): number[] {
  if (Array.isArray(days)) return days;
  try {
    const parsed = JSON.parse(days);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
