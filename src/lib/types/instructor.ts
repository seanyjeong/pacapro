/**
 * Instructor Type Definitions
 * 강사 관련 타입 정의 - DB 스키마와 일치
 */

// ===== 기본 타입 정의 =====

// 급여 타입 (salary_type) - DB enum
export type SalaryType = 'hourly' | 'per_class' | 'monthly' | 'mixed';

// 세금 타입 (tax_type) - DB enum
export type TaxType = '3.3%' | 'insurance' | 'none';

// 강사 상태 (status) - DB enum
export type InstructorStatus = 'active' | 'on_leave' | 'retired';

// 강사 유형 (instructor_type) - 시급제일 때만 사용
export type InstructorType = 'teacher' | 'assistant';

// ===== 강사 인터페이스 =====

// 기본 강사 인터페이스 - DB 스키마 매칭
export interface Instructor {
  id: number;
  academy_id: number;
  user_id: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  birth_date: string | null; // YYYY-MM-DD
  resident_number: string | null;
  hire_date: string | null; // YYYY-MM-DD
  salary_type: SalaryType;
  instructor_type: InstructorType | null; // 시급제일 때만 사용
  base_salary: string; // decimal -> string
  hourly_rate: string; // decimal -> string
  morning_class_rate: string; // decimal -> string
  afternoon_class_rate: string; // decimal -> string
  evening_class_rate: string; // decimal -> string
  incentive_rate: string; // decimal -> string
  tax_type: TaxType;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  status: InstructorStatus;
  notes: string | null;
  // 사무보조 근무설정
  work_days: number[] | null; // [1, 3, 5] 형태 (0=일~6=토)
  work_start_time: string | null; // HH:MM
  work_end_time: string | null; // HH:MM
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// 강사 등록/수정용 DTO
export interface InstructorFormData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  birth_date?: string;
  resident_number?: string;
  hire_date?: string;
  salary_type: SalaryType;
  instructor_type?: InstructorType; // 시급제일 때만 사용
  base_salary?: number;
  hourly_rate?: number;
  morning_class_rate?: number;
  afternoon_class_rate?: number;
  evening_class_rate?: number;
  incentive_rate?: number;
  tax_type: TaxType;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  status?: InstructorStatus;
  notes?: string;
  // 사무보조 근무설정
  work_days?: number[];
  work_start_time?: string;
  work_end_time?: string;
}

// 강사 필터 인터페이스
export interface InstructorFilters {
  status?: InstructorStatus;
  salary_type?: SalaryType;
  instructor_type?: InstructorType;
  search?: string;
}

// 강사 상세 정보 (academy 정보 포함)
export interface InstructorDetail extends Instructor {
  academy_name?: string;
}

// ===== 출퇴근 기록 =====

export interface InstructorAttendance {
  id: number;
  instructor_id: number;
  academy_id?: number;
  attendance_date: string; // YYYY-MM-DD
  check_in: string | null; // HH:mm:ss
  check_out: string | null; // HH:mm:ss
  work_hours: string | null; // decimal
  notes: string | null;
  created_at: string;
}

// ===== 급여 기록 =====

export interface SalaryRecord {
  id: number;
  instructor_id: number;
  academy_id?: number;
  instructor_name?: string;
  year_month: string; // YYYY-MM (급여 귀속 월)
  // 기본 급여 정보
  base_amount: string; // decimal - 기본급
  incentive_amount: string; // decimal - 인센티브/상여금
  total_deduction: string; // decimal - 총 공제액
  tax_amount: string; // decimal - 세금
  net_salary: string; // decimal - 실수령액
  // 시급제 강사용 추가 필드
  total_hours?: number; // 총 근무 시간
  // 상태
  payment_status: 'pending' | 'paid';
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

// ===== API 응답 타입 =====

export interface InstructorsResponse {
  message: string;
  instructors: Instructor[];
}

export interface InstructorDetailResponse {
  message?: string;
  instructor: InstructorDetail;
  attendances: InstructorAttendance[];
  salaries: SalaryRecord[];
}

export interface InstructorCreateResponse {
  message: string;
  instructor: Instructor;
}

export interface InstructorUpdateResponse {
  message: string;
  instructor: Instructor;
}

export interface InstructorDeleteResponse {
  message: string;
  instructor: {
    id: number;
    name: string;
  };
}

// ===== 레이블 매핑 =====

export const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  hourly: '시급제',
  per_class: '수업당',
  monthly: '월급제',
  mixed: '혼합형',
};

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  '3.3%': '3.3% 원천징수',
  insurance: '4대보험',
  none: '없음',
};

export const INSTRUCTOR_STATUS_LABELS: Record<InstructorStatus, string> = {
  active: '재직',
  on_leave: '휴직',
  retired: '퇴사',
};

export const INSTRUCTOR_TYPE_LABELS: Record<InstructorType, string> = {
  teacher: '수업강사',
  assistant: '사무보조',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '미지급',
  unpaid: '미지급',
  paid: '지급완료',
};

// ===== 옵션 데이터 =====

// 급여타입 옵션
export const SALARY_TYPE_OPTIONS = [
  { value: 'hourly' as SalaryType, label: '시급제' },
  { value: 'per_class' as SalaryType, label: '수업당' },
  { value: 'monthly' as SalaryType, label: '월급제' },
  { value: 'mixed' as SalaryType, label: '혼합형' },
];

// 세금타입 옵션
export const TAX_TYPE_OPTIONS = [
  { value: '3.3%' as TaxType, label: '3.3% 원천징수' },
  { value: 'insurance' as TaxType, label: '4대보험' },
  { value: 'none' as TaxType, label: '없음' },
];

// 상태 옵션
export const INSTRUCTOR_STATUS_OPTIONS = [
  { value: 'active' as InstructorStatus, label: '재직' },
  { value: 'on_leave' as InstructorStatus, label: '휴직' },
  { value: 'retired' as InstructorStatus, label: '퇴사' },
];

// 강사 유형 옵션 (시급제일 때만 표시)
export const INSTRUCTOR_TYPE_OPTIONS = [
  { value: 'teacher' as InstructorType, label: '수업강사' },
  { value: 'assistant' as InstructorType, label: '사무보조' },
];

// 요일 옵션
export const WEEKDAY_OPTIONS = [
  { value: 0, label: '일' },
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
];

// ===== 유틸리티 함수 =====

// 금액 포맷 (decimal string -> 원화 표시)
export function formatSalary(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0원';
  return new Intl.NumberFormat('ko-KR').format(num) + '원';
}

// 근무시간 포맷
export function formatWorkHours(hours: string | number | null): string {
  if (hours === null) return '-';
  const num = typeof hours === 'string' ? parseFloat(hours) : hours;
  if (isNaN(num)) return '-';
  return `${num.toFixed(1)}시간`;
}
