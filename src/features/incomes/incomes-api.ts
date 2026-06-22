import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import { exportsApi } from '@/lib/api/exports';
import type { IncomeFormData, OtherIncomesResponse, TuitionPaymentsResponse } from './incomes-types';
import { getMonthRange } from './incomes-utils';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export async function getIncomePageData(yearMonth: string) {
  const range = getMonthRange(yearMonth);
  const [incomesResponse, paymentsResponse] = await Promise.all([
    apiClient.get<OtherIncomesResponse>('/incomes', {
      ...SILENT_CONFIG,
      params: { start_date: range.startDate, end_date: range.endDate },
    }),
    apiClient.get<TuitionPaymentsResponse>('/payments', {
      ...SILENT_CONFIG,
      params: { paid_year: range.year, paid_month: range.month, payment_status: 'paid' },
    }),
  ]);

  return {
    otherIncomes: incomesResponse.incomes || [],
    tuitionPayments: paymentsResponse.payments || [],
  };
}

export function createOtherIncome(data: IncomeFormData): Promise<unknown> {
  return apiClient.post<unknown>('/incomes', data, SILENT_CONFIG);
}

export function updateOtherIncome(id: number, data: IncomeFormData): Promise<unknown> {
  return apiClient.put<unknown>(`/incomes/${id}`, data, SILENT_CONFIG);
}

export function deleteOtherIncome(id: number): Promise<unknown> {
  return apiClient.delete<unknown>(`/incomes/${id}`, SILENT_CONFIG);
}

export function downloadRevenue(yearMonth: string): Promise<void> {
  const range = getMonthRange(yearMonth);
  return exportsApi.downloadRevenue({ start_date: range.startDate, end_date: range.endDate });
}
