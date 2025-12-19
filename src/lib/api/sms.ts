/**
 * SMS API 클라이언트
 */

import apiClient from './client';

interface SendSMSResponse {
  message: string;
  sent: number;
  failed: number;
  total: number;
}

interface RecipientsCountResponse {
  all: number;
  students: number;
  parents: number;
}

interface SMSLog {
  id: number;
  academy_id: number;
  student_id: number | null;
  recipient_name: string;
  recipient_phone: string;
  message_type: string;
  message_content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  error_message: string | null;
  request_id: string | null;
  sent_at: string | null;
  created_at: string;
}

interface LogsResponse {
  logs: SMSLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const smsAPI = {
  /**
   * SMS/MMS 발송
   */
  send: async (params: {
    target: 'all' | 'students' | 'parents' | 'custom';
    content: string;
    customPhones?: string[];
    images?: { name: string; data: string }[];  // MMS 이미지 (base64)
    gradeFilter?: 'all' | 'junior' | 'senior' | 'pending';  // 학년/상태 필터
  }): Promise<SendSMSResponse> => {
    return apiClient.post<SendSMSResponse>('/sms/send', params);
  },

  /**
   * 수신자 수 조회
   */
  getRecipientsCount: async (gradeFilter?: string): Promise<RecipientsCountResponse> => {
    return apiClient.get<RecipientsCountResponse>('/sms/recipients-count', {
      params: gradeFilter ? { gradeFilter } : {}
    });
  },

  /**
   * 발송 내역 조회
   */
  getLogs: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<LogsResponse> => {
    return apiClient.get<LogsResponse>('/sms/logs', { params });
  },
};
