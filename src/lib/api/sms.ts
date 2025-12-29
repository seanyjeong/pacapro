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

interface SenderNumber {
  id: number;
  service_type: 'solapi' | 'sens';
  phone: string;
  label: string | null;
  is_default: number;
  created_at: string;
}

interface SenderNumbersResponse {
  senderNumbers: SenderNumber[];
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
    statusFilter?: 'active' | 'pending';  // 상태 필터
    gradeFilter?: 'all' | 'junior' | 'senior';  // 학년 필터
    senderNumberId?: number;  // 선택한 발신번호 ID
  }): Promise<SendSMSResponse> => {
    return apiClient.post<SendSMSResponse>('/sms/send', params);
  },

  /**
   * 수신자 수 조회
   */
  getRecipientsCount: async (statusFilter?: string, gradeFilter?: string): Promise<RecipientsCountResponse> => {
    const params: Record<string, string> = {};
    if (statusFilter) params.statusFilter = statusFilter;
    if (gradeFilter) params.gradeFilter = gradeFilter;
    return apiClient.get<RecipientsCountResponse>('/sms/recipients-count', { params });
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

  /**
   * 발신번호 목록 조회
   */
  getSenderNumbers: async (serviceType?: 'solapi' | 'sens'): Promise<SenderNumbersResponse> => {
    const params: Record<string, string> = {};
    if (serviceType) params.serviceType = serviceType;
    return apiClient.get<SenderNumbersResponse>('/sms/sender-numbers', { params });
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
