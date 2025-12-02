/**
 * 알림톡 API 클라이언트
 */

import apiClient from './client';

export interface NotificationSettings {
  naver_access_key: string;
  naver_secret_key: string;
  naver_service_id: string;
  kakao_channel_id: string;
  template_code: string;
  template_content: string;  // 템플릿 본문 (변수: #{이름}, #{날짜}, #{금액} 등)
  is_enabled: boolean;
  auto_send_day: number;
  has_secret_key?: boolean;
}

export interface NotificationLog {
  id: number;
  academy_id: number;
  student_id: number | null;
  payment_id: number | null;
  recipient_name: string;
  recipient_phone: string;
  message_type: 'alimtalk' | 'sms';
  template_code: string;
  message_content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  error_message: string | null;
  request_id: string | null;
  sent_at: string | null;
  created_at: string;
  student_name?: string;
}

export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
}

interface SettingsResponse {
  message: string;
  settings: NotificationSettings;
}

interface LogsResponse {
  message: string;
  logs: NotificationLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface StatsResponse {
  message: string;
  stats: NotificationStats;
}

interface SendResponse {
  message: string;
  success?: boolean;
  sent?: number;
  failed?: number;
  requestId?: string;
}

export const notificationsAPI = {
  /**
   * 알림 설정 조회
   */
  getSettings: async (): Promise<NotificationSettings> => {
    const response = await apiClient.get<SettingsResponse>('/notifications/settings');
    return response.settings;
  },

  /**
   * 알림 설정 저장
   */
  saveSettings: async (settings: Partial<NotificationSettings>): Promise<void> => {
    await apiClient.put<{ message: string }>('/notifications/settings', settings);
  },

  /**
   * 테스트 메시지 발송
   */
  sendTest: async (phone: string): Promise<{ success: boolean; requestId?: string }> => {
    const response = await apiClient.post<SendResponse>('/notifications/test', { phone });
    return { success: response.success || false, requestId: response.requestId };
  },

  /**
   * 미납자 일괄 알림 발송
   */
  sendUnpaid: async (year: number, month: number): Promise<{ sent: number; failed: number }> => {
    const response = await apiClient.post<SendResponse>('/notifications/send-unpaid', { year, month });
    return { sent: response.sent || 0, failed: response.failed || 0 };
  },

  /**
   * 개별 학생 알림 발송
   */
  sendIndividual: async (paymentId: number): Promise<{ success: boolean }> => {
    const response = await apiClient.post<SendResponse>('/notifications/send-individual', { payment_id: paymentId });
    return { success: response.success || false };
  },

  /**
   * 발송 내역 조회
   */
  getLogs: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    logs: NotificationLog[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> => {
    const response = await apiClient.get<LogsResponse>('/notifications/logs', { params });
    return { logs: response.logs, pagination: response.pagination };
  },

  /**
   * 발송 통계 조회
   */
  getStats: async (year?: number, month?: number): Promise<NotificationStats> => {
    const params = year && month ? { year, month } : {};
    const response = await apiClient.get<StatsResponse>('/notifications/stats', { params });
    return response.stats;
  },
};
