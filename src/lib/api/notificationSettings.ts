/**
 * 알림 설정 API
 */

import apiClient from './client';

export interface NotificationSettings {
  unpaid_attendance: boolean;    // 미납자 출석 알림
  consultation_reminder: boolean; // 상담 30분 전 알림
  new_consultation: boolean;      // 새 상담 예약 알림
  pause_ending: boolean;          // 휴원 종료 알림
}

interface NotificationSettingsResponse {
  settings: NotificationSettings;
}

interface UpdateResponse {
  message: string;
  settings: NotificationSettings;
}

export const notificationSettingsAPI = {
  // 알림 설정 조회
  get: async (): Promise<NotificationSettings> => {
    const response = await apiClient.get<NotificationSettingsResponse>('/notification-settings');
    return response.settings;
  },

  // 알림 설정 업데이트
  update: async (settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
    const response = await apiClient.put<UpdateResponse>('/notification-settings', settings);
    return response.settings;
  },
};
