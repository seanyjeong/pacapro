/**
 * Salary Type Definitions
 * 급여 관련 타입 정의
 */

// 세금 타입 (DB: '3.3%', 'insurance', 'none' / 레거시: 'resident', 'freelancer')
export type TaxType = '3.3%' | 'insurance' | 'none' | 'resident' | 'freelancer';

// 기본 급여 기록 인터페이스
export interface Salary {
  id: number;
  instructor_id: number;
  instructor_name: string;
  year_month: string; // YYYY-MM
  base_amount: number; // 기본 급여
  incentive_amount: number; // 인센티브
  total_deduction: number; // 공제액
  tax_type: TaxType;
  tax_amount: number; // 세금
  insurance_details?: string | object; // 보험료 상세 (JSON)
  net_salary: number; // 실수령액
  payment_date?: string; // 지급일
  payment_status: 'pending' | 'paid';
  created_at: string;
  updated_at?: string;
}

// 급여 상세 정보 (강사 정보 포함)
export interface SalaryDetail extends Salary {
  salary_type?: 'hourly' | 'monthly';
  hourly_rate?: number;
  monthly_salary?: number;
}

// 급여 등록/수정용 DTO
export interface SalaryFormData {
  instructor_id: number;
  year_month: string; // YYYY-MM
  base_amount: number;
  incentive_amount?: number;
  total_deduction?: number;
  tax_type: TaxType;
  tax_amount?: number;
  insurance_details?: object;
  net_salary: number;
}

// 급여 계산 요청 DTO
export interface SalaryCalculationRequest {
  instructor_id: number;
  year: number;
  month: number;
  incentive_amount?: number;
  total_deduction?: number;
  work_data?: {
    hours_worked?: number;
    days_worked?: number;
    classes_taught?: number;
  };
}

// 급여 계산 결과
export interface SalaryCalculationResult {
  base_amount: number;
  incentive_amount: number;
  gross_salary: number; // 총 급여
  tax_type: TaxType;
  tax_amount: number;
  insurance_amount: number;
  total_deduction: number;
  net_salary: number; // 실수령액
  breakdown: {
    salary_type?: string;
    total_hours?: number;
    total_classes?: number;
    morning_classes?: number;
    afternoon_classes?: number;
    evening_classes?: number;
    income_tax?: number;
    resident_tax?: number;
    national_pension?: number;
    health_insurance?: number;
    employment_insurance?: number;
    other_deductions?: number;
  };
}

// 급여 필터 인터페이스
export interface SalaryFilters {
  instructor_id?: number;
  year?: number;
  month?: number;
  payment_status?: 'pending' | 'paid';
}

// API 응답 타입
export interface SalariesResponse {
  message: string;
  salaries: Salary[];
}

export interface SalaryDetailResponse {
  salary: SalaryDetail;
}

export interface SalaryCreateResponse {
  message: string;
  salary: Salary;
}

export interface SalaryUpdateResponse {
  message: string;
  salary: Salary;
}

export interface SalaryDeleteResponse {
  message: string;
  salary: {
    id: number;
    instructor_name: string;
    year_month: string;
  };
}

export interface SalaryCalculationResponse {
  message: string;
  instructor: {
    id: number;
    name: string;
    salary_type: string;
  };
  salary: SalaryCalculationResult;
}

// 한글 매핑 (DB 값과 일치하도록)
export const TAX_TYPE_LABELS: Record<string, string> = {
  '3.3%': '3.3% 과세',
  'insurance': '4대보험',
  'none': '비과세',
  // 레거시 호환
  resident: '3.3% 과세',
  freelancer: '4대보험',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '미지급',
  paid: '지급완료',
};

// 옵션 리스트
export const TAX_TYPE_OPTIONS = [
  { value: '3.3%', label: '3.3% 과세' },
  { value: 'insurance', label: '4대보험' },
  { value: 'none', label: '비과세' },
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: '미지급' },
  { value: 'paid', label: '지급완료' },
];

// 세율 상수 (2026년 기준)
// 4대보험 근로자 부담: 국민연금 4.75% + 건강보험 3.595% + 장기요양 0.47% + 고용보험 0.9% ≈ 9.72%
export const TAX_RATES: Record<string, number> = {
  '3.3%': 0.033,
  'insurance': 0.0972, // 2026년 4대보험 근로자 부담 합계
  'none': 0,
  // 레거시 호환
  resident: 0.033,
  freelancer: 0.0972,
};
