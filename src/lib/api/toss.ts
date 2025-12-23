/**
 * 토스플레이스 연동 API 클라이언트
 * P-ACA 프론트엔드에서 토스 결제 관련 API 호출
 */

import apiClient from './client';

// ============================================
// 타입 정의
// ============================================

export interface TossPaymentHistory {
  id: number;
  payment_id: number;
  academy_id: number;
  order_id: string;
  payment_key: string;
  amount: number;
  method: string;
  approved_at: string;
  receipt_url?: string;
  card_company?: string;
  card_number?: string;
  installment_months: number;
  status: string;
  created_at: string;
  // JOIN 필드
  year_month?: string;
  student_name?: string;
  student_number?: string;
}

export interface TossQueueItem {
  id: number;
  academy_id?: number;
  order_id: string;
  payment_key: string;
  amount: number;
  method?: string;
  approved_at?: string;
  receipt_url?: string;
  card_company?: string;
  merchant_id?: string;
  metadata?: Record<string, unknown>;
  match_status: 'pending' | 'matched' | 'ignored' | 'error';
  matched_payment_id?: number;
  matched_at?: string;
  matched_by?: number;
  error_reason?: string;
  created_at: string;
}

export interface TossSettings {
  id: number;
  academy_id: number;
  merchant_id?: string;
  is_active: boolean;
  auto_match_enabled: boolean;
  auto_receipt_print: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TossQueueStats {
  pending?: { count: number; amount: number };
  matched?: { count: number; amount: number };
  ignored?: { count: number; amount: number };
  error?: { count: number; amount: number };
}

export interface TossPaymentStats {
  total_count: number;
  total_amount: number;
  unique_payments: number;
  method: string;
  date: string;
}

// ============================================
// API 함수
// ============================================

export const tossAPI = {
  /**
   * 토스 결제 이력 조회
   */
  getHistory: async (params?: {
    payment_id?: number;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.payment_id) queryParams.append('payment_id', params.payment_id.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return await apiClient.get<{
      success: boolean;
      total: number;
      history: TossPaymentHistory[];
    }>(`/toss/history${query ? `?${query}` : ''}`);
  },

  /**
   * 매칭 대기열 조회
   */
  getQueue: async (status: string = 'pending', limit: number = 50) => {
    return await apiClient.get<{
      success: boolean;
      stats: TossQueueStats;
      queue: TossQueueItem[];
    }>(`/toss/queue?status=${status}&limit=${limit}`);
  },

  /**
   * 수동 매칭 처리
   */
  manualMatch: async (queueId: number, paymentId: number) => {
    return await apiClient.post<{
      success: boolean;
      message: string;
      paymentId: number;
      newStatus: string;
      paidAmount: number;
    }>(`/toss/queue/${queueId}/match`, { payment_id: paymentId });
  },

  /**
   * 대기열 항목 무시 처리
   */
  ignoreQueueItem: async (queueId: number, reason?: string) => {
    return await apiClient.post<{ success: boolean; message: string }>(
      `/toss/queue/${queueId}/ignore`,
      { reason }
    );
  },

  /**
   * 토스 결제 통계 조회
   */
  getStats: async (yearMonth?: string) => {
    const query = yearMonth ? `?year_month=${yearMonth}` : '';
    return await apiClient.get<{
      success: boolean;
      month: string;
      paymentStats: TossPaymentStats[];
      queueStats: Record<string, number>;
    }>(`/toss/stats${query}`);
  },

  /**
   * 토스 연동 설정 조회
   */
  getSettings: async () => {
    return await apiClient.get<{
      success: boolean;
      settings: TossSettings | null;
      message?: string;
    }>('/toss/settings');
  },

  /**
   * 토스 연동 설정 저장
   */
  saveSettings: async (settings: Partial<TossSettings> & {
    plugin_api_key?: string;
    callback_secret?: string;
  }) => {
    return await apiClient.put<{ success: boolean; message: string }>(
      '/toss/settings',
      settings
    );
  },
};

export default tossAPI;
