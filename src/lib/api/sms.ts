/**
 * SMS API client
 * Backend: /sms/* endpoints
 */

import apiClient from './client';

// Backend NotificationLog fields (SMS logs use the same table)
export interface SMSLog {
  id: number;
  academy_id?: number;
  type: string; // 'sms'
  recipient: string | null;
  content: string | null;
  status: 'sent' | 'failed';
  error_message: string | null;
  is_read?: boolean;
  created_at: string;
  // Frontend aliases (optional)
  recipient_name?: string;
  student_name?: string;
}

export interface SenderNumber {
  id?: number;
  number: string;
  phone?: string; // Frontend alias for number
  is_default: boolean;
  service_type?: 'solapi' | 'sens';
  label?: string | null;
  created_at?: string;
}

export const smsAPI = {
  // POST /sms/send → flat log dict
  // Backend body: {to, content, type="sms"}
  send: async (params: {
    to: string;
    content: string;
    type?: string;
  }): Promise<SMSLog> => {
    return apiClient.post<SMSLog>('/sms/send', {
      to: params.to,
      content: params.content,
      type: params.type || 'sms',
    });
  },

  // POST /sms/send-bulk → {sent, recipients}
  // Backend body: {recipients[], content, type="sms"}
  sendBulk: async (params: {
    recipients: string[];
    content: string;
    type?: string;
  }): Promise<{ sent: number; recipients: string[] }> => {
    return apiClient.post('/sms/send-bulk', {
      recipients: params.recipients,
      content: params.content,
      type: params.type || 'sms',
    });
  },

  // GET /sms/recipients-count → {count}
  // Backend params: status?, time_slot?
  getRecipientsCount: async (status?: string, timeSlot?: string): Promise<{ count: number }> => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (timeSlot) params.time_slot = timeSlot;
    return apiClient.get<{ count: number }>('/sms/recipients-count', { params });
  },

  // GET /sms/logs → flat array
  // Backend params: limit?, status?
  getLogs: async (params?: {
    limit?: number;
    status?: string;
  }): Promise<SMSLog[]> => {
    return apiClient.get<SMSLog[]>('/sms/logs', { params });
  },

  // GET /sms/history → flat array (alias for logs)
  getHistory: async (params?: {
    limit?: number;
    status?: string;
  }): Promise<SMSLog[]> => {
    return apiClient.get<SMSLog[]>('/sms/history', { params });
  },

  // GET /sms/balance → {provider, balance, message}
  getBalance: async (): Promise<{ provider: string; balance: number | null; message: string }> => {
    return apiClient.get('/sms/balance');
  },

  // GET /sms/sender-numbers → flat array of {number, is_default}
  getSenderNumbers: async (): Promise<SenderNumber[]> => {
    return apiClient.get<SenderNumber[]>('/sms/sender-numbers');
  },

  // GET /sms/templates → flat array
  getTemplates: async (): Promise<{ id: number; name: string; content: string; type: string }[]> => {
    return apiClient.get('/sms/templates');
  },

  // --- Sender number CRUD (not yet in backend, stubs for frontend UI) ---
  addSenderNumber: async (params: {
    serviceType: 'solapi' | 'sens';
    phone: string;
    label?: string;
  }): Promise<SenderNumber> => {
    return apiClient.post<SenderNumber>('/sms/sender-numbers', params);
  },

  updateSenderNumber: async (id: number, params: {
    label?: string;
    isDefault?: boolean;
  }): Promise<void> => {
    await apiClient.put(`/sms/sender-numbers/${id}`, params);
  },

  deleteSenderNumber: async (id: number): Promise<void> => {
    await apiClient.delete(`/sms/sender-numbers/${id}`);
  },
};
