/**
 * 시즌 관리 타입 정의
 * 수시/정시 시즌, 학생 시즌등록, 일할계산 관련
 */

// 시즌 타입 (수시/정시)
export type SeasonType = 'early' | 'regular';

// 시즌 상태
export type SeasonStatus = 'draft' | 'active' | 'completed' | 'ended' | 'cancelled';

// 연속등록 할인 타입
export type ContinuousDiscountType = 'none' | 'free' | 'rate';

// 시간대 타입
export type TimeSlot = 'morning' | 'afternoon' | 'evening';

// 학년별 시간대 설정 (다중 선택 가능)
export interface GradeTimeSlots {
  [grade: string]: TimeSlot[]; // { "고3": ["afternoon", "evening"], "N수": ["morning", "afternoon"] }
}

// 시즌 대상 학년 (고3, N수만 시즌 사용)
export const SEASON_TARGET_GRADES = ['고3', 'N수'] as const;
export type SeasonTargetGrade = typeof SEASON_TARGET_GRADES[number];

// 학생 시즌등록 상태
export type StudentSeasonStatus = 'registered' | 'active' | 'completed' | 'cancelled' | 'refunded';

// 시즌 인터페이스 (백엔드 응답과 일치)
export interface Season {
  id: number;
  academy_id: number;
  season_name: string;
  season_type: SeasonType;
  season_start_date: string;  // 백엔드 필드명
  season_end_date: string;    // 백엔드 필드명
  non_season_end_date: string | null; // 비시즌 종강일 (일할계산용)
  operating_days: number[] | string; // JSON string 또는 배열
  grade_time_slots: GradeTimeSlots | string | null; // 학년별 시간대 설정
  default_season_fee: string; // 백엔드 필드명 (decimal)
  allows_continuous: boolean;
  continuous_to_season_type: SeasonType | null;
  continuous_discount_type: ContinuousDiscountType;
  continuous_discount_rate: number;
  status: SeasonStatus;
  created_at: string;
  updated_at: string;
}

// 시즌 생성/수정용 데이터
export interface SeasonFormData {
  season_name: string;
  season_type: SeasonType;
  year: number;
  start_date: string;
  end_date: string;
  non_season_end_date?: string;
  operating_days: number[];
  grade_time_slots?: GradeTimeSlots; // 학년별 시간대 설정
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

// 학생 시즌 등록 정보
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'cancelled';

export interface StudentSeason {
  id: number;
  student_id: number;
  season_id: number;
  season_name?: string;
  student_name?: string;
  student_number?: string;
  student_grade?: string; // 학생 학년
  season_fee: string;
  registration_date: string | null; // 시즌 등록일
  prorated_month: string | null; // YYYY-MM
  prorated_amount: string | null;
  prorated_details: ProRatedDetails | null;
  is_continuous: boolean;
  previous_season_id: number | null;
  discount_type: ContinuousDiscountType | 'custom' | null;
  discount_amount: string | null;
  final_fee: string;
  status: StudentSeasonStatus;
  payment_status: PaymentStatus;  // 납부 상태
  registered_at: string;
  notes: string | null;
  time_slots?: TimeSlot[] | string; // 시간대 (JSON 또는 배열)
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

// 시즌 등록 요청 데이터
export interface SeasonEnrollData {
  student_id: number;
  season_fee: number; // 필수
  registration_date?: string;
  after_season_action?: 'regular' | 'n_su' | 'graduate';
  is_continuous?: boolean;
  previous_season_id?: number;
  time_slots?: TimeSlot[]; // 고3/N수용 여러 시간대 선택
  discount_amount?: number; // 수동 할인 금액
  discount_reason?: string; // 할인 사유
  notes?: string;
}

// 시즌 중간 합류 일할계산 정보
export interface MidSeasonProRated {
  is_mid_season: boolean;
  original_fee: number;
  prorated_fee: number;
  discount: number;
  total_days: number;
  remaining_days: number;
  details: string;
}

// 일할계산 미리보기 응답
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
  mid_season_prorated: MidSeasonProRated | null;  // 시즌 중간 합류 일할계산
  continuous_discount: {
    is_continuous: boolean;
    discount_type: ContinuousDiscountType;
    discount_rate: number;
    discount_amount: number;
  } | null;
  final_calculation: {
    season_fee: number;
    original_season_fee?: number;  // 일할 전 원래 시즌비
    mid_season_discount?: number;  // 시즌 중간 합류 할인액
    prorated_fee: number;
    discount_amount: number;
    total_due: number;
  };
  // 비시즌 종강 일할 정보 (시즌 전달 학원비에서 별도 청구됨)
  non_season_prorated_info?: {
    amount: number;
    days: number;
    message: string;
  } | null;
}

// 시즌 등록 결과
export interface SeasonEnrollResult {
  message: string;
  enrollment: StudentSeason;
}

// API 응답 타입
export interface SeasonsResponse {
  message: string;
  seasons: Season[];
}

export interface SeasonDetailResponse {
  message: string;
  season: Season;
  enrolled_students?: StudentSeason[];
}

export interface SeasonCreateResponse {
  message: string;
  season: Season;
}

export interface SeasonUpdateResponse {
  message: string;
  season: Season;
}

// 환불 계산 결과
export interface RefundData {
  // 기본 정보
  paidAmount: number;
  originalFee: number;
  discountAmount: number;

  // 수업일 정보
  totalClassDays: number;
  attendedDays: number;
  remainingDays: number;
  progressRate: string;

  // 일할계산 기준
  usedAmount: number;
  usedRate: string;
  refundAmount: number;
  refundRate: string;

  // 부가세 옵션
  includeVat: boolean;
  vatAmount: number;
  refundAfterVat: number;

  // 학원법 기준
  legalRefundRate: string;
  legalRefundReason: string;
  legalRefundAmount: number;

  // 최종
  finalRefundAmount: number;

  // 상세
  calculationDetails: {
    paidAmount: string;
    perClassFee: string;
    usedFormula: string;
    refundFormula: string;
    vatFormula: string | null;
  };
}

// 환불 미리보기 응답
export interface RefundPreviewResponse {
  enrollment: {
    id: number;
    student_name: string;
    season_name: string;
    season_start_date: string;
    season_end_date: string;
    original_fee: number;
    discount_amount: number;
    paid_amount: number;
    payment_status: string;
  };
  cancellation_date: string;
  refund: RefundData;
  academy: {
    academy_name?: string;
    phone?: string;
    address?: string;
  };
}

// 레이블 매핑
export const SEASON_TYPE_LABELS: Record<SeasonType, string> = {
  early: '수시',
  regular: '정시',
};

export const SEASON_STATUS_LABELS: Record<SeasonStatus, string> = {
  draft: '준비중',
  active: '진행중',
  completed: '종료',
  ended: '종료',
  cancelled: '취소',
};

export const CONTINUOUS_DISCOUNT_TYPE_LABELS: Record<ContinuousDiscountType, string> = {
  none: '없음',
  free: '무료',
  rate: '할인율',
};

export const STUDENT_SEASON_STATUS_LABELS: Record<StudentSeasonStatus, string> = {
  registered: '등록완료',
  active: '진행중',
  completed: '수강완료',
  cancelled: '취소',
  refunded: '환불',
};

// 옵션 데이터
export const SEASON_TYPE_OPTIONS = [
  { value: 'early' as SeasonType, label: '수시' },
  { value: 'regular' as SeasonType, label: '정시' },
];

export const SEASON_STATUS_OPTIONS = [
  { value: 'draft' as SeasonStatus, label: '준비중' },
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
