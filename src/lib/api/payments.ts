/**
 * Payments API Client
 * Aligned with FastAPI backend (api/app/routers/academy/payments)
 */

import apiClient from './client';
import type {
  Payment,
  PaymentFormData,
  PaymentRecordData,
  BulkMonthlyChargeData,
  PaymentFilters,
  BulkChargeResponse,
  PaymentStatsResponse,
  PaymentHistoryResponse,
  PrepaidPreviewRequest,
  PrepaidPreviewResponse,
  PrepaidPayRequest,
  PrepaidPayResponse,
  PrepaidBalanceResponse,
  CreditsSummaryResponse,
} from '@/lib/types/payment';

export const paymentsAPI = {
  /**
   * GET /payments
   * Backend returns Payment[] directly (no wrapper)
   */
  getPayments: async (filters?: PaymentFilters): Promise<Payment[]> => {
    const params = new URLSearchParams();
    if (filters?.student_id) params.append('student_id', filters.student_id.toString());
    if (filters?.payment_status) params.append('payment_status', filters.payment_status);
    if (filters?.year_month) params.append('year_month', filters.year_month);

    const queryString = params.toString();
    const url = queryString ? `/payments?${queryString}` : '/payments';
    return await apiClient.get<Payment[]>(url);
  },

  /**
   * GET /payments/unpaid?year_month=YYYY-MM
   * Backend returns Payment[] directly
   */
  getUnpaidPayments: async (yearMonth: string): Promise<Payment[]> => {
    return await apiClient.get<Payment[]>(`/payments/unpaid?year_month=${yearMonth}`);
  },

  /**
   * GET /payments/unpaid-today
   * Backend returns Payment[] directly
   */
  getUnpaidTodayPayments: async (): Promise<Payment[]> => {
    return await apiClient.get<Payment[]>('/payments/unpaid-today');
  },

  /**
   * GET /payments/{id}
   * Backend returns Payment directly
   */
  getPayment: async (id: number): Promise<Payment> => {
    return await apiClient.get<Payment>(`/payments/${id}`);
  },

  /**
   * POST /payments
   * Backend returns Payment directly
   */
  createPayment: async (data: PaymentFormData): Promise<Payment> => {
    return await apiClient.post<Payment>('/payments', data);
  },

  /**
   * POST /payments/bulk-monthly
   * Backend expects { year_month, overwrite }
   */
  bulkMonthlyCharge: async (data: BulkMonthlyChargeData): Promise<BulkChargeResponse> => {
    return await apiClient.post<BulkChargeResponse>('/payments/bulk-monthly', data);
  },

  /**
   * POST /payments/{id}/pay
   * Backend expects { paid_amount, payment_method, paid_date?, notes? }
   */
  recordPayment: async (id: number, data: PaymentRecordData): Promise<Payment> => {
    return await apiClient.post<Payment>(`/payments/${id}/pay`, data);
  },

  /**
   * PUT /payments/{id}
   * Backend returns Payment directly
   */
  updatePayment: async (id: number, data: Partial<PaymentFormData>): Promise<Payment> => {
    return await apiClient.put<Payment>(`/payments/${id}`, data);
  },

  /**
   * DELETE /payments/{id}
   * Backend returns { message: string }
   */
  deletePayment: async (id: number): Promise<{ message: string }> => {
    return await apiClient.delete<{ message: string }>(`/payments/${id}`);
  },

  /**
   * GET /payments/stats/summary?year_month=YYYY-MM
   * Backend returns stats directly
   */
  getPaymentStats: async (yearMonth?: string): Promise<PaymentStatsResponse> => {
    const url = yearMonth
      ? `/payments/stats/summary?year_month=${yearMonth}`
      : '/payments/stats/summary';
    return await apiClient.get<PaymentStatsResponse>(url);
  },

  /**
   * GET /payments/student/{studentId}/history
   */
  getPaymentHistory: async (studentId: number): Promise<PaymentHistoryResponse> => {
    return await apiClient.get<PaymentHistoryResponse>(`/payments/student/${studentId}/history`);
  },

  /**
   * POST /payments/prepaid-preview
   * Backend expects { student_id, months: int }
   */
  prepaidPreview: async (data: PrepaidPreviewRequest): Promise<PrepaidPreviewResponse> => {
    return await apiClient.post<PrepaidPreviewResponse>('/payments/prepaid-preview', data);
  },

  /**
   * POST /payments/prepaid-pay
   * Backend expects { student_id, months: int, amount: int }
   */
  prepaidPay: async (data: PrepaidPayRequest): Promise<PrepaidPayResponse> => {
    return await apiClient.post<PrepaidPayResponse>('/payments/prepaid-pay', data);
  },

  /**
   * GET /payments/prepaid/{studentId}
   */
  getPrepaidBalance: async (studentId: number): Promise<PrepaidBalanceResponse> => {
    return await apiClient.get<PrepaidBalanceResponse>(`/payments/prepaid/${studentId}`);
  },

  /**
   * POST /payments/prepaid/{studentId}
   * Add prepaid credit
   */
  addPrepaidCredit: async (studentId: number, data: { amount: number; payment_method?: string; notes?: string }): Promise<Payment> => {
    return await apiClient.post<Payment>(`/payments/prepaid/${studentId}`, data);
  },

  // ===== Credits =====

  /**
   * GET /payments/credits
   * Backend returns Payment[] directly (discount_amount > 0)
   */
  getCredits: async (): Promise<Payment[]> => {
    return await apiClient.get<Payment[]>('/payments/credits');
  },

  /**
   * GET /payments/credits/summary
   */
  getCreditsSummary: async (): Promise<CreditsSummaryResponse> => {
    return await apiClient.get<CreditsSummaryResponse>('/payments/credits/summary');
  },
};
