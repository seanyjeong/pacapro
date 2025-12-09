/**
 * Salaries API Client
 * 급여 관련 API 호출 함수
 */

import apiClient from './client';
import type {
  Salary,
  SalaryFormData,
  SalaryCalculationRequest,
  SalariesResponse,
  SalaryDetailResponse,
  SalaryCreateResponse,
  SalaryUpdateResponse,
  SalaryDeleteResponse,
  SalaryCalculationResponse,
  SalaryFilters,
} from '@/lib/types/salary';

export interface WorkSummary {
  year_month: string;
  morning_classes: number;
  afternoon_classes: number;
  evening_classes: number;
  total_classes: number;
  total_hours: number;
  attendance_days: number;
  daily_breakdown?: Record<string, string[]>; // { "2025-11-25": ["오전", "오후"], "2025-11-26": ["오후"] }
}

export interface WorkSummaryResponse {
  message: string;
  instructor: {
    id: number;
    name: string;
    salary_type: string;
    hourly_rate: string;
    base_salary: string;
    tax_type: string;
    morning_class_rate: string;
    afternoon_class_rate: string;
    evening_class_rate: string;
  };
  work_summary: WorkSummary;
}

export const salariesAPI = {
  /**
   * 월별 근무 요약 조회
   * GET /paca/salaries/work-summary/:instructorId/:yearMonth
   */
  getWorkSummary: async (instructorId: number, yearMonth: string): Promise<WorkSummaryResponse> => {
    return await apiClient.get<WorkSummaryResponse>(`/salaries/work-summary/${instructorId}/${yearMonth}`);
  },

  /**
   * 급여 목록 조회 (필터링)
   * GET /paca/salaries
   */
  getSalaries: async (filters?: SalaryFilters): Promise<SalariesResponse> => {
    const params = new URLSearchParams();

    if (filters?.instructor_id) params.append('instructor_id', filters.instructor_id.toString());
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.month) params.append('month', filters.month.toString());
    if (filters?.payment_status) params.append('payment_status', filters.payment_status);

    const queryString = params.toString();
    const url = queryString ? `/salaries?${queryString}` : '/salaries';

    return await apiClient.get<SalariesResponse>(url);
  },

  /**
   * 급여 상세 조회
   * GET /paca/salaries/:id
   */
  getSalary: async (id: number): Promise<SalaryDetailResponse> => {
    return await apiClient.get<SalaryDetailResponse>(`/salaries/${id}`);
  },

  /**
   * 급여 계산
   * POST /paca/salaries/calculate
   */
  calculateSalary: async (data: SalaryCalculationRequest): Promise<SalaryCalculationResponse> => {
    return await apiClient.post<SalaryCalculationResponse>('/salaries/calculate', data);
  },

  /**
   * 급여 기록 등록
   * POST /paca/salaries
   */
  createSalary: async (data: SalaryFormData): Promise<SalaryCreateResponse> => {
    return await apiClient.post<SalaryCreateResponse>('/salaries', data);
  },

  /**
   * 급여 지급 기록
   * POST /paca/salaries/:id/pay
   */
  recordPayment: async (id: number, payment_date?: string): Promise<SalaryUpdateResponse> => {
    return await apiClient.post<SalaryUpdateResponse>(`/salaries/${id}/pay`, { payment_date });
  },

  /**
   * 급여 수정
   * PUT /paca/salaries/:id
   */
  updateSalary: async (id: number, data: Partial<SalaryFormData>): Promise<SalaryUpdateResponse> => {
    return await apiClient.put<SalaryUpdateResponse>(`/salaries/${id}`, data);
  },

  /**
   * 급여 삭제
   * DELETE /paca/salaries/:id
   */
  deleteSalary: async (id: number): Promise<SalaryDeleteResponse> => {
    return await apiClient.delete<SalaryDeleteResponse>(`/salaries/${id}`);
  },

  /**
   * 급여 일괄 지급
   * POST /paca/salaries/bulk-pay
   */
  bulkRecordPayment: async (params: {
    year_month?: string;
    salary_ids?: number[];
    payment_date?: string;
  }): Promise<{
    message: string;
    paid_count: number;
    salaries: Array<{
      id: number;
      instructor_name: string;
      net_salary: string;
      year_month: string;
    }>;
  }> => {
    return await apiClient.post('/salaries/bulk-pay', params);
  },
};
