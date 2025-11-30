/**
 * Payments API Client
 * 학원비 관련 API 호출 함수
 */

import apiClient from './client';
import type {
  Payment,
  PaymentFormData,
  PaymentRecordData,
  BulkMonthlyChargeData,
  PaymentsResponse,
  PaymentDetailResponse,
  PaymentCreateResponse,
  PaymentUpdateResponse,
  PaymentDeleteResponse,
  UnpaidPaymentsResponse,
  BulkChargeResponse,
  PaymentStatsResponse,
  PaymentFilters,
} from '@/lib/types/payment';

export const paymentsAPI = {
  /**
   * 학원비 목록 조회 (필터링)
   * GET /paca/payments
   */
  getPayments: async (filters?: PaymentFilters): Promise<PaymentsResponse> => {
    const params = new URLSearchParams();

    if (filters?.student_id) params.append('student_id', filters.student_id.toString());
    if (filters?.payment_status) params.append('payment_status', filters.payment_status);
    if (filters?.payment_type) params.append('payment_type', filters.payment_type);
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.month) params.append('month', filters.month.toString());

    const queryString = params.toString();
    const url = queryString ? `/payments?${queryString}` : '/payments';

    return await apiClient.get<PaymentsResponse>(url);
  },

  /**
   * 미납/연체 학원비 조회
   * GET /paca/payments/unpaid
   */
  getUnpaidPayments: async (): Promise<UnpaidPaymentsResponse> => {
    return await apiClient.get<UnpaidPaymentsResponse>('/payments/unpaid');
  },

  /**
   * 학원비 상세 조회
   * GET /paca/payments/:id
   */
  getPayment: async (id: number): Promise<PaymentDetailResponse> => {
    return await apiClient.get<PaymentDetailResponse>(`/payments/${id}`);
  },

  /**
   * 학원비 청구 등록
   * POST /paca/payments
   */
  createPayment: async (data: PaymentFormData): Promise<PaymentCreateResponse> => {
    return await apiClient.post<PaymentCreateResponse>('/payments', data);
  },

  /**
   * 일괄 월 수강료 청구
   * POST /paca/payments/bulk-monthly
   */
  bulkMonthlyCharge: async (data: BulkMonthlyChargeData): Promise<BulkChargeResponse> => {
    return await apiClient.post<BulkChargeResponse>('/payments/bulk-monthly', data);
  },

  /**
   * 납부 기록
   * POST /paca/payments/:id/pay
   */
  recordPayment: async (id: number, data: PaymentRecordData): Promise<PaymentUpdateResponse> => {
    return await apiClient.post<PaymentUpdateResponse>(`/payments/${id}/pay`, data);
  },

  /**
   * 학원비 수정
   * PUT /paca/payments/:id
   */
  updatePayment: async (id: number, data: Partial<PaymentFormData>): Promise<PaymentUpdateResponse> => {
    return await apiClient.put<PaymentUpdateResponse>(`/payments/${id}`, data);
  },

  /**
   * 학원비 삭제
   * DELETE /paca/payments/:id
   */
  deletePayment: async (id: number): Promise<PaymentDeleteResponse> => {
    return await apiClient.delete<PaymentDeleteResponse>(`/payments/${id}`);
  },

  /**
   * 학원비 통계 조회
   * GET /paca/payments/stats/summary
   */
  getPaymentStats: async (year?: number, month?: number): Promise<PaymentStatsResponse> => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());

    const queryString = params.toString();
    const url = queryString ? `/payments/stats/summary?${queryString}` : '/payments/stats/summary';

    return await apiClient.get<PaymentStatsResponse>(url);
  },
};
