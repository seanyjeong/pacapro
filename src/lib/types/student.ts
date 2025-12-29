/**
 * Student Type Definitions
 * 학생 관련 타입 정의 - DB 스키마와 일치
 */

// ===== 기본 타입 정의 =====

// 학생 유형 (student_type) - 입시생/성인
export type StudentType = 'exam' | 'adult';

// 학년 (grade) - 입시생용
export type Grade = '고1' | '고2' | '고3' | 'N수';

// 입시 유형 (admission_type)
export type AdmissionType = 'regular' | 'early' | 'civil_service' | 'military_academy' | 'police_university';

// 학생 상태 (status) - DB enum
export type StudentStatus = 'active' | 'paused' | 'graduated' | 'withdrawn' | 'trial' | 'pending';

// 성별 (gender)
export type Gender = 'male' | 'female';

// ===== 학생 인터페이스 =====

// 체험 일정 타입
export interface TrialDate {
  date: string; // YYYY-MM-DD
  time_slot: 'morning' | 'afternoon' | 'evening';
  attended?: boolean; // 출석 여부
}

// 기본 학생 인터페이스 - DB 스키마 매칭
export interface Student {
  id: number;
  academy_id: number;
  student_number: string | null;
  name: string;
  gender: Gender | null; // 성별
  student_type: StudentType; // 입시생/성인
  phone: string | null;
  parent_phone: string | null;
  school: string | null;
  grade: Grade | null; // 학년 (고1, 고2, 고3, N수) - 입시생용
  age: number | null; // 나이 - 성인용
  address: string | null;
  admission_type: AdmissionType; // regular, early, civil_service
  profile_image_url: string | null;
  class_days: number[] | string; // JSON array 또는 string
  weekly_count: number;
  monthly_tuition: string; // decimal -> string
  discount_rate: string; // decimal -> string
  discount_reason: string | null; // 할인 사유
  payment_due_day: number | null; // 개별 납부일
  final_monthly_tuition: string | null;
  is_season_registered: boolean;
  current_season_id: number | null;
  status: StudentStatus;
  rest_start_date: string | null; // 휴식 시작일
  rest_end_date: string | null; // 휴식 종료일 (null이면 무기한)
  rest_reason: string | null; // 휴식 사유
  enrollment_date: string | null;
  withdrawal_date: string | null;
  notes: string | null;
  // 체험생 관련 필드
  is_trial: boolean | null; // 체험생 여부
  trial_remaining: number | null; // 남은 체험 횟수
  trial_dates: TrialDate[] | string | null; // 체험 일정
  // 시간대
  time_slot: 'morning' | 'afternoon' | 'evening' | null; // 수업 시간대
  // 메모
  memo: string | null; // 학생 메모
  // 상담일
  consultation_date: string | null; // 상담 완료일
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// 학생 등록/수정용 DTO
export interface StudentFormData {
  student_number?: string;
  name: string;
  gender?: Gender;
  student_type: StudentType;
  phone: string;
  parent_phone?: string;
  school?: string;
  grade?: Grade; // 입시생용
  age?: number; // 성인용
  address?: string;
  admission_type: AdmissionType;
  class_days: number[]; // [1, 3, 5] = 월, 수, 금
  weekly_count: number;
  monthly_tuition: number;
  discount_rate?: number;
  discount_reason?: string; // 할인 사유
  payment_due_day?: number; // 개별 납부일 (1~28, null이면 학원 기본값 사용)
  status?: StudentStatus;
  rest_start_date?: string; // 휴식 시작일
  rest_end_date?: string; // 휴식 종료일
  rest_reason?: string; // 휴식 사유
  enrollment_date?: string;
  notes?: string;
  // 시즌 등록 옵션 (고3, N수 학생용)
  enroll_in_season?: boolean;
  selected_season_id?: number;
  // 체험생 관련 필드
  is_trial?: boolean; // 체험생으로 등록
  trial_remaining?: number; // 체험 횟수 (기본 2)
  trial_dates?: TrialDate[]; // 체험 일정 배열
  // 시간대
  time_slot?: 'morning' | 'afternoon' | 'evening'; // 수업 시간대 (기본: evening)
  // 메모
  memo?: string; // 학생 메모
}

// 학생 필터 인터페이스
export interface StudentFilters {
  student_type?: StudentType;
  grade?: Grade;
  admission_type?: AdmissionType;
  status?: StudentStatus;
  gender?: Gender;
  search?: string;
  is_trial?: boolean; // 체험생 필터
}

// 학생 상세 정보 (성적, 납부내역 포함)
export interface StudentDetail extends Student {
  academy_name?: string;
}

// 성적 기록
export interface StudentPerformance {
  id: number;
  student_id: number;
  record_date: string;
  record_type: 'mock_exam' | 'physical' | 'competition';
  subject?: string;
  score?: number;
  max_score?: number;
  grade_rank?: number;
  school_rank?: number;
  performance_data?: Record<string, unknown>;
  notes?: string;
  created_at: string;
}

// 납부 내역
export interface StudentPayment {
  id: number;
  student_id: number;
  student_name?: string;
  year_month: string;
  base_amount: string;
  discount_amount: string;
  final_amount: string;
  paid_amount: string;
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  payment_method?: 'account' | 'card' | 'cash' | 'other';
  paid_date?: string;
  due_date: string;
  notes?: string;
  created_at: string;
}

// ===== API 응답 타입 =====

export interface StudentsResponse {
  message: string;
  students: Student[];
}

export interface StudentDetailResponse {
  message?: string;
  student: StudentDetail;
  performances: StudentPerformance[];
  payments: StudentPayment[];
}

export interface StudentCreateResponse {
  message: string;
  student: Student;
}

export interface StudentUpdateResponse {
  message: string;
  student: Student;
}

export interface StudentDeleteResponse {
  message: string;
  student: {
    id: number;
    name: string;
  };
}

// ===== 레이블 매핑 =====

export const STUDENT_TYPE_LABELS: Record<StudentType, string> = {
  exam: '입시생',
  adult: '성인',
};

export const GRADE_LABELS: Record<Grade, string> = {
  '고1': '고1',
  '고2': '고2',
  '고3': '고3',
  'N수': 'N수',
};

export const ADMISSION_TYPE_LABELS: Record<AdmissionType, string> = {
  regular: '정시',
  early: '수시',
  civil_service: '공무원',
  military_academy: '사관학교',
  police_university: '경찰대',
};

export const STATUS_LABELS: Record<StudentStatus, string> = {
  active: '재원',
  paused: '휴원',
  graduated: '졸업',
  withdrawn: '퇴원',
  trial: '체험',
  pending: '미등록관리',
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: '남',
  female: '여',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '미납',
  partial: '부분납',
  paid: '완납',
  overdue: '연체',
};

// 요일 매핑 (숫자 -> 한글)
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const WEEKDAY_MAP: Record<number, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
};

// ===== 옵션 데이터 =====

// 학생 유형 옵션
export const STUDENT_TYPE_OPTIONS = [
  { value: 'exam' as StudentType, label: '입시생' },
  { value: 'adult' as StudentType, label: '성인' },
];

// 성별 옵션
export const GENDER_OPTIONS = [
  { value: 'male' as Gender, label: '남자' },
  { value: 'female' as Gender, label: '여자' },
];

// 학년 옵션 (입시생용)
export const GRADE_OPTIONS = [
  { value: '고1' as Grade, label: '고1' },
  { value: '고2' as Grade, label: '고2' },
  { value: '고3' as Grade, label: '고3' },
  { value: 'N수' as Grade, label: 'N수' },
];

// 입시 유형 옵션 (입시생용)
export const EXAM_ADMISSION_OPTIONS = [
  { value: 'regular' as AdmissionType, label: '정시' },
  { value: 'early' as AdmissionType, label: '수시' },
  { value: 'military_academy' as AdmissionType, label: '사관학교' },
  { value: 'police_university' as AdmissionType, label: '경찰대' },
];

// 입시 유형 옵션 (성인용)
export const ADULT_ADMISSION_OPTIONS = [
  { value: 'civil_service' as AdmissionType, label: '공무원' },
];

// 전체 입시 유형 옵션
export const ADMISSION_TYPE_OPTIONS = [
  { value: 'regular' as AdmissionType, label: '정시' },
  { value: 'early' as AdmissionType, label: '수시' },
  { value: 'military_academy' as AdmissionType, label: '사관학교' },
  { value: 'police_university' as AdmissionType, label: '경찰대' },
  { value: 'civil_service' as AdmissionType, label: '공무원' },
];

// 상태 옵션
export const STATUS_OPTIONS = [
  { value: 'active' as StudentStatus, label: '재원' },
  { value: 'paused' as StudentStatus, label: '휴원' },
  { value: 'graduated' as StudentStatus, label: '졸업' },
  { value: 'withdrawn' as StudentStatus, label: '퇴원' },
  { value: 'trial' as StudentStatus, label: '체험' },
  { value: 'pending' as StudentStatus, label: '미등록관리' },
];

// 요일 옵션 (체크박스용)
export const WEEKDAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

// ===== 유틸리티 함수 =====

// class_days 파싱 (JSON string -> array)
export function parseClassDays(classDays: number[] | string): number[] {
  if (Array.isArray(classDays)) {
    return classDays;
  }
  try {
    const parsed = JSON.parse(classDays);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// class_days를 한글로 변환
export function formatClassDays(classDays: number[] | string): string {
  const days = parseClassDays(classDays);
  return days.map(d => WEEKDAY_MAP[d] || '').filter(Boolean).join(', ');
}

// 금액 포맷 (decimal string -> 원화 표시)
export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('ko-KR').format(num) + '원';
}

// 할인율 포맷
export function formatDiscountRate(rate: string | number): string {
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  return num > 0 ? `${num}%` : '-';
}

// ===== 휴식 크레딧 관련 타입 =====

export type RestCreditType = 'carryover' | 'refund' | 'excused' | 'manual';
export type RestCreditStatus = 'pending' | 'partial' | 'applied' | 'refunded' | 'cancelled';

// 휴식 크레딧 인터페이스
export interface RestCredit {
  id: number;
  student_id: number;
  academy_id: number;
  source_payment_id: number | null;
  rest_start_date: string;
  rest_end_date: string;
  rest_days: number;
  credit_amount: number;
  remaining_amount: number;
  credit_type: RestCreditType;
  status: RestCreditStatus;
  applied_to_payment_id: number | null;
  created_at: string;
  processed_at: string | null;
  notes: string | null;
}

// 휴식 처리 요청 DTO
export interface RestProcessRequest {
  rest_start_date: string;
  rest_end_date?: string; // null이면 무기한
  rest_reason?: string;
  credit_type?: RestCreditType | 'none';
  source_payment_id?: number;
}

// 휴식 처리 응답
export interface RestProcessResponse {
  message: string;
  student: Student;
  restCredit?: RestCredit;
}

// 휴식 크레딧 목록 응답
export interface RestCreditsResponse {
  message: string;
  student: { id: number; name: string };
  credits: RestCredit[];
  pendingTotal: number;
}

// 휴식 크레딧 타입 레이블
export const REST_CREDIT_TYPE_LABELS: Record<RestCreditType, string> = {
  carryover: '이월',
  refund: '환불',
  excused: '공결',
  manual: '수동',
};

// 휴식 크레딧 상태 레이블
export const REST_CREDIT_STATUS_LABELS: Record<RestCreditStatus, string> = {
  pending: '미적용',
  partial: '부분적용',
  applied: '적용완료',
  refunded: '환불완료',
  cancelled: '취소',
};

// ===== 수동 크레딧 관련 타입 =====

// 수동 크레딧 생성 요청 DTO
export interface ManualCreditRequest {
  // 날짜로 입력 시
  start_date?: string;  // YYYY-MM-DD
  end_date?: string;    // YYYY-MM-DD
  // 회차로 입력 시
  class_count?: number; // 1~12
  // 공통
  reason: string;
  notes?: string;
}

// 수동 크레딧 생성 응답
export interface ManualCreditResponse {
  message: string;
  credit: RestCredit;
  calculation: {
    monthly_tuition: number;
    weekly_count: number;
    per_class_fee: number;
    class_count: number;
    class_dates: string[] | null;
    total_credit: number;
  };
}
