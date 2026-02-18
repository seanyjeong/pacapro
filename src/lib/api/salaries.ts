/**
 * Salaries API Client
 * Aligned with FastAPI backend (api/app/routers/academy/salaries)
 */

import apiClient from './client';
import type {
  Salary,
  SalaryFormData,
  SalaryCalculateRequest,
  BulkPayRequest,
  SalaryFilters,
  SalarySummaryResponse,
  WorkSummaryResponse,
} from '@/lib/types/salary';

export const salariesAPI = {
  /**
   * GET /paca/salaries
   */
  getSalaries: async (filters?: SalaryFilters): Promise<Salary[]> => {
    const params = new URLSearchParams();
    if (filters?.instructor_id) params.append('instructor_id', filters.instructor_id.toString());
    if (filters?.year_month) params.append('year_month', filters.year_month);
    if (filters?.payment_status) params.append('payment_status', filters.payment_status);

    const queryString = params.toString();
    const url = queryString ? `/salaries?${queryString}` : '/salaries';
    return await apiClient.get<Salary[]>(url);
  },

  /**
   * GET /paca/salaries/:id
   */
  getSalary: async (id: number): Promise<Salary> => {
    return await apiClient.get<Salary>(`/salaries/${id}`);
  },

  /**
   * POST /paca/salaries
   */
  createSalary: async (data: SalaryFormData): Promise<Salary> => {
    return await apiClient.post<Salary>('/salaries', data);
  },

  /**
   * POST /paca/salaries/calculate
   * Creates a salary record based on instructor's schedule
   */
  calculateSalary: async (data: SalaryCalculateRequest): Promise<Salary> => {
    return await apiClient.post<Salary>('/salaries/calculate', data);
  },

  /**
   * POST /paca/salaries/recalculate/:id
   */
  recalculateSalary: async (id: number): Promise<Salary> => {
    return await apiClient.post<Salary>(`/salaries/recalculate/${id}`);
  },

  /**
   * PUT /paca/salaries/:id
   */
  updateSalary: async (id: number, data: Partial<SalaryFormData>): Promise<Salary> => {
    return await apiClient.put<Salary>(`/salaries/${id}`, data);
  },

  /**
   * DELETE /paca/salaries/:id
   */
  deleteSalary: async (id: number): Promise<{ message: string }> => {
    return await apiClient.delete<{ message: string }>(`/salaries/${id}`);
  },

  /**
   * POST /paca/salaries/:id/pay
   * Backend sets paid_date=today, paid_amount=total_salary, status="paid"
   */
  recordPayment: async (id: number): Promise<Salary> => {
    return await apiClient.post<Salary>(`/salaries/${id}/pay`);
  },

  /**
   * POST /paca/salaries/bulk-pay
   */
  bulkRecordPayment: async (data: BulkPayRequest): Promise<{ message: string; updated_ids: number[] }> => {
    return await apiClient.post<{ message: string; updated_ids: number[] }>('/salaries/bulk-pay', data);
  },

  /**
   * GET /paca/salaries/summary?year_month=YYYY-MM
   */
  getSummary: async (yearMonth: string): Promise<SalarySummaryResponse> => {
    return await apiClient.get<SalarySummaryResponse>(`/salaries/summary?year_month=${yearMonth}`);
  },

  /**
   * GET /paca/salaries/work-summary?instructor_id=N&year_month=YYYY-MM
   */
  getWorkSummary: async (instructorId: number, yearMonth: string): Promise<WorkSummaryResponse> => {
    return await apiClient.get<WorkSummaryResponse>(
      `/salaries/work-summary?instructor_id=${instructorId}&year_month=${yearMonth}`
    );
  },
};
