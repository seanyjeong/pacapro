/**
 * SMS API 클라이언트
 */

import apiClient, { type APIRequestConfig } from './client';

export interface SendSMSResponse {
  message: string;
  sent: number;
  failed: number;
  total: number;
}

export interface RecipientsCountResponse {
  all: number;
  students: number;
  parents: number;
}

export interface SMSLog {
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

export interface LogsResponse {
  logs: SMSLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SenderNumber {
  id: number;
  service_type: 'solapi' | 'sens';
  phone: string;
  label: string | null;
  is_default: number;
  created_at: string;
}

export interface SenderNumbersResponse {
  senderNumbers: SenderNumber[];
}

export interface SendSMSParams {
  target: 'all' | 'students' | 'parents' | 'custom';
  content: string;
  customPhones?: string[];
  images?: { name: string; data: string }[];
  statusFilter?: 'active' | 'pending';
  gradeFilter?: 'all' | 'junior' | 'senior';
  senderNumberId?: number;
}

export const smsAPI = {
  /**
   * SMS/MMS 발송
   */
  send: async (params: SendSMSParams, config?: APIRequestConfig): Promise<SendSMSResponse> => {
    return apiClient.post<SendSMSResponse>('/sms/send', params, config);
  },

  /**
   * 수신자 수 조회
   */
  getRecipientsCount: async (
    statusFilter?: string,
    gradeFilter?: string,
    config?: APIRequestConfig
  ): Promise<RecipientsCountResponse> => {
    const params: Record<string, string> = {};
    if (statusFilter) params.statusFilter = statusFilter;
    if (gradeFilter) params.gradeFilter = gradeFilter;
    return apiClient.get<RecipientsCountResponse>('/sms/recipients-count', { ...config, params });
  },

  /**
   * 발송 내역 조회
   */
  getLogs: async (
    params?: {
      page?: number;
      limit?: number;
    },
    config?: APIRequestConfig
  ): Promise<LogsResponse> => {
    return apiClient.get<LogsResponse>('/sms/logs', { ...config, params });
  },

  /**
   * 발신번호 목록 조회
   */
  getSenderNumbers: async (
    serviceType?: 'solapi' | 'sens',
    config?: APIRequestConfig
  ): Promise<SenderNumbersResponse> => {
    const params: Record<string, string> = {};
    if (serviceType) params.serviceType = serviceType;
    return apiClient.get<SenderNumbersResponse>('/sms/sender-numbers', { ...config, params });
  },

  /**
   * 발신번호 추가
   */
  addSenderNumber: async (params: {
    serviceType: 'solapi' | 'sens';
    phone: string;
    label?: string;
  }): Promise<{ message: string; senderNumber: SenderNumber }> => {
    return apiClient.post('/sms/sender-numbers', params);
  },

  /**
   * 발신번호 수정
   */
  updateSenderNumber: async (id: number, params: {
    label?: string;
    isDefault?: boolean;
  }): Promise<{ message: string }> => {
    return apiClient.put(`/sms/sender-numbers/${id}`, params);
  },

  /**
   * 발신번호 삭제
   */
  deleteSenderNumber: async (id: number): Promise<{ message: string }> => {
    return apiClient.delete(`/sms/sender-numbers/${id}`);
  },
};
