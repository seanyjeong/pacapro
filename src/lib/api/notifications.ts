/**
 * Notifications API client
 * Backend: /notifications/* endpoints
 */

import apiClient from './client';

// --- Backend-aligned types ---

// Backend NotificationSettings model fields
export interface NotificationSettings {
  id?: number;
  academy_id?: number;
  // Solapi
  solapi_api_key: string;
  solapi_api_secret: string;
  solapi_sender: string;
  solapi_pfid: string;
  solapi_templates: string | null; // JSON string
  // NAVER SENS
  sens_access_key: string;
  sens_secret_key: string;
  sens_service_id: string;
  sens_sender: string;
  sens_templates: string | null; // JSON string
  // Config
  provider: 'solapi' | 'sens';
  created_at?: string;

  // --- Frontend-only fields (not in backend DB, sent via PUT but Pydantic drops extras) ---
  // SENS template details (stored in sens_templates JSON)
  has_secret_key?: boolean;
  sms_service_id?: string;
  kakao_channel_id?: string;
  template_code?: string;
  template_content?: string;
  sens_buttons?: ConsultationButton[];
  sens_image_url?: string;
  sens_auto_enabled?: boolean;
  sens_auto_hour?: number;
  sens_consultation_template_code?: string;
  sens_consultation_template_content?: string;
  sens_consultation_buttons?: ConsultationButton[];
  sens_consultation_image_url?: string;
  sens_trial_template_code?: string;
  sens_trial_template_content?: string;
  sens_trial_buttons?: ConsultationButton[];
  sens_trial_image_url?: string;
  sens_trial_auto_enabled?: boolean;
  sens_trial_auto_hour?: number;
  sens_overdue_template_code?: string;
  sens_overdue_template_content?: string;
  sens_overdue_buttons?: ConsultationButton[];
  sens_overdue_image_url?: string;
  sens_overdue_auto_enabled?: boolean;
  sens_overdue_auto_hour?: number;
  sens_reminder_template_code?: string;
  sens_reminder_template_content?: string;
  sens_reminder_buttons?: ConsultationButton[];
  sens_reminder_image_url?: string;
  sens_reminder_auto_enabled?: boolean;
  sens_reminder_hours?: number;
  // Solapi template details (stored in solapi_templates JSON)
  has_solapi_secret?: boolean;
  solapi_template_id?: string;
  solapi_template_content?: string;
  solapi_buttons?: ConsultationButton[];
  solapi_image_url?: string;
  solapi_auto_enabled?: boolean;
  solapi_auto_hour?: number;
  solapi_consultation_template_id?: string;
  solapi_consultation_template_content?: string;
  solapi_consultation_buttons?: ConsultationButton[];
  solapi_consultation_image_url?: string;
  solapi_trial_template_id?: string;
  solapi_trial_template_content?: string;
  solapi_trial_buttons?: ConsultationButton[];
  solapi_trial_image_url?: string;
  solapi_trial_auto_enabled?: boolean;
  solapi_trial_auto_hour?: number;
  solapi_overdue_template_id?: string;
  solapi_overdue_template_content?: string;
  solapi_overdue_buttons?: ConsultationButton[];
  solapi_overdue_image_url?: string;
  solapi_overdue_auto_enabled?: boolean;
  solapi_overdue_auto_hour?: number;
  solapi_reminder_template_id?: string;
  solapi_reminder_template_content?: string;
  solapi_reminder_buttons?: ConsultationButton[];
  solapi_reminder_image_url?: string;
  solapi_reminder_auto_enabled?: boolean;
  solapi_reminder_hours?: number;
  // Common toggles (frontend-only)
  is_enabled?: boolean;
  solapi_enabled?: boolean;
}

export interface ConsultationButton {
  buttonType: 'WL' | 'AL' | 'BK' | 'MD';
  buttonName: string;
  linkMo?: string;
  linkPc?: string;
}

// Backend NotificationLog model fields
export interface NotificationLog {
  id: number;
  academy_id?: number;
  type: 'sms' | 'alimtalk' | 'push';
  recipient: string | null;
  content: string | null;
  status: 'sent' | 'failed';
  error_message: string | null;
  is_read?: boolean;
  created_at: string;
  // Frontend-only / legacy aliases (optional)
  student_id?: number | null;
  payment_id?: number | null;
  recipient_name?: string;
  student_name?: string;
  request_id?: string | null;
  sent_at?: string | null;
}

export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
}

export interface NotificationTemplate {
  id: number;
  name: string;
  content: string;
  type: string;
}

function mapLog(raw: Record<string, unknown>): NotificationLog {
  return {
    ...(raw as unknown as NotificationLog),
    // Legacy aliases for components that still use old field names
    recipient_name: (raw.recipient as string) || '',
  };
}

export const notificationsAPI = {
  // GET /notifications/settings → flat dict or null
  getSettings: async (): Promise<NotificationSettings | null> => {
    return apiClient.get<NotificationSettings | null>('/notifications/settings');
  },

  // PUT /notifications/settings → flat dict
  saveSettings: async (settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
    return apiClient.put<NotificationSettings>('/notifications/settings', settings);
  },

  // POST /notifications/test → {success, log}
  sendTest: async (recipient: string, content?: string): Promise<{ success: boolean; log: NotificationLog }> => {
    return apiClient.post<{ success: boolean; log: NotificationLog }>('/notifications/test', {
      type: 'sms',
      recipient,
      content: content || 'This is a test notification.',
    });
  },

  // POST /notifications/send → flat log dict
  send: async (params: { type?: string; recipient: string; content: string }): Promise<NotificationLog> => {
    const raw = await apiClient.post<Record<string, unknown>>('/notifications/send', {
      type: params.type || 'sms',
      recipient: params.recipient,
      content: params.content,
    });
    return mapLog(raw);
  },

  // POST /notifications/send-bulk → {sent, recipients}
  sendBulk: async (params: { type?: string; recipients: string[]; content: string }): Promise<{ sent: number; recipients: string[] }> => {
    return apiClient.post('/notifications/send-bulk', {
      type: params.type || 'sms',
      recipients: params.recipients,
      content: params.content,
    });
  },

  // GET /notifications/logs → flat array (params: type?, status?, limit?)
  getLogs: async (params?: {
    type?: string;
    status?: string;
    limit?: number;
  }): Promise<NotificationLog[]> => {
    const raw = await apiClient.get<Record<string, unknown>[]>('/notifications/logs', { params });
    return raw.map(mapLog);
  },

  // GET /notifications/templates → flat array
  getTemplates: async (): Promise<NotificationTemplate[]> => {
    return apiClient.get<NotificationTemplate[]>('/notifications/templates');
  },

  // POST /notifications/templates → flat dict
  createTemplate: async (params: { name: string; content: string; type?: string }): Promise<NotificationTemplate> => {
    return apiClient.post<NotificationTemplate>('/notifications/templates', {
      name: params.name,
      content: params.content,
      type: params.type || 'sms',
    });
  },

  // PUT /notifications/templates/:id → flat dict
  updateTemplate: async (id: number, params: { name?: string; content?: string; type?: string }): Promise<NotificationTemplate> => {
    return apiClient.put<NotificationTemplate>(`/notifications/templates/${id}`, params);
  },

  // DELETE /notifications/templates/:id → {deleted}
  deleteTemplate: async (id: number): Promise<{ deleted: number }> => {
    return apiClient.delete<{ deleted: number }>(`/notifications/templates/${id}`);
  },

  // --- Test endpoints per template type ---
  // Backend only has /notifications/test; these call the same endpoint with different content
  sendTestConsultation: async (phone: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean }>('/notifications/test', {
      type: 'alimtalk', recipient: phone, content: '[TEST] Consultation notification',
    });
    return { success: res.success };
  },

  sendTestTrial: async (phone: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean }>('/notifications/test', {
      type: 'alimtalk', recipient: phone, content: '[TEST] Trial class notification',
    });
    return { success: res.success };
  },

  sendTestOverdue: async (phone: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean }>('/notifications/test', {
      type: 'alimtalk', recipient: phone, content: '[TEST] Overdue payment notification',
    });
    return { success: res.success };
  },

  sendTestReminder: async (phone: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean }>('/notifications/test', {
      type: 'alimtalk', recipient: phone, content: '[TEST] Consultation reminder',
    });
    return { success: res.success };
  },

  sendTestSensConsultation: async (phone: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean }>('/notifications/test', {
      type: 'alimtalk', recipient: phone, content: '[TEST] SENS Consultation notification',
    });
    return { success: res.success };
  },

  sendTestSensTrial: async (phone: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean }>('/notifications/test', {
      type: 'alimtalk', recipient: phone, content: '[TEST] SENS Trial class notification',
    });
    return { success: res.success };
  },

  sendTestSensOverdue: async (phone: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean }>('/notifications/test', {
      type: 'alimtalk', recipient: phone, content: '[TEST] SENS Overdue payment notification',
    });
    return { success: res.success };
  },

  sendTestSensReminder: async (phone: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean }>('/notifications/test', {
      type: 'alimtalk', recipient: phone, content: '[TEST] SENS Consultation reminder',
    });
    return { success: res.success };
  },

  // POST /notifications/send-bulk (batch unpaid)
  sendUnpaid: async (year: number, month: number): Promise<{ sent: number; failed: number }> => {
    // Backend doesn't have a dedicated /send-unpaid endpoint;
    // this would need to be orchestrated client-side or added to backend
    const res = await apiClient.post<{ sent: number; recipients?: string[] }>('/notifications/send-bulk', {
      type: 'alimtalk',
      recipients: [], // Caller should provide actual recipients
      content: `${year}년 ${month}월 미납 안내`,
    });
    return { sent: res.sent || 0, failed: 0 };
  },

  // POST /notifications/send (individual)
  sendIndividual: async (recipient: string, content: string): Promise<{ success: boolean }> => {
    const log = await apiClient.post<Record<string, unknown>>('/notifications/send', {
      type: 'alimtalk',
      recipient,
      content,
    });
    return { success: log.status === 'sent' };
  },
};
