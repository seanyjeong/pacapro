import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { SalaryFormData } from '@/lib/types/salary';
import type { SalaryDetailResponseForPage } from './salary-detail-types';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export function getSalaryDetailForPage(id: number): Promise<SalaryDetailResponseForPage> {
  return apiClient.get<SalaryDetailResponseForPage>(`/salaries/${id}`, SILENT_CONFIG);
}

export function recordSalaryPayment(id: number, paymentDate?: string): Promise<unknown> {
  return apiClient.post(`/salaries/${id}/pay`, { payment_date: paymentDate }, SILENT_CONFIG);
}

export function updateSalaryForPage(id: number, data: Partial<SalaryFormData>): Promise<unknown> {
  return apiClient.put(`/salaries/${id}`, data, SILENT_CONFIG);
}

export function recalculateSalaryForPage(id: number): Promise<{
  message: string;
  salary: {
    base_amount: number;
    net_salary: number;
  };
}> {
  return apiClient.post(`/salaries/${id}/recalculate`, undefined, SILENT_CONFIG);
}
