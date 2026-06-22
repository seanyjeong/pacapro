import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import { exportsApi } from '@/lib/api/exports';
import type { ExpenseFormData, ExpensesResponse } from './expenses-types';
import { getMonthRange } from './expenses-utils';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export async function getExpenses(yearMonth: string) {
  const range = getMonthRange(yearMonth);
  const response = await apiClient.get<ExpensesResponse>('/expenses', {
    ...SILENT_CONFIG,
    params: { start_date: range.startDate, end_date: range.endDate },
  });

  return response.expenses || [];
}

export function createExpense(data: ExpenseFormData): Promise<unknown> {
  return apiClient.post<unknown>('/expenses', data, SILENT_CONFIG);
}

export function updateExpense(id: number, data: ExpenseFormData): Promise<unknown> {
  return apiClient.put<unknown>(`/expenses/${id}`, data, SILENT_CONFIG);
}

export function deleteExpense(id: number): Promise<unknown> {
  return apiClient.delete<unknown>(`/expenses/${id}`, SILENT_CONFIG);
}

export function completeRefund(id: number, paymentMethod = 'cash'): Promise<unknown> {
  return apiClient.post<unknown>(`/expenses/${id}/complete-refund`, { payment_method: paymentMethod }, SILENT_CONFIG);
}

export function downloadExpenses(): Promise<void> {
  return exportsApi.downloadExpenses();
}
