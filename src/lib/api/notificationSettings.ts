/**
 * Push notification preference settings API
 * Backend: /notification-settings (not yet implemented - placeholder)
 * These are boolean toggle preferences for push notification types,
 * separate from the provider settings in /notifications/settings.
 */

import apiClient from './client';

export interface NotificationSettings {
  unpaid_attendance: boolean;    // Unpaid student attendance alert
  consultation_reminder: boolean; // Consultation 30min reminder
  new_consultation: boolean;      // New consultation booking alert
  pause_ending: boolean;          // Pause ending alert
}

export const notificationSettingsAPI = {
  // GET /notification-settings → flat dict (or null)
  get: async (): Promise<NotificationSettings> => {
    const response = await apiClient.get<NotificationSettings | null>('/notification-settings');
    return response || {
      unpaid_attendance: true,
      consultation_reminder: true,
      new_consultation: true,
      pause_ending: true,
    };
  },

  // PUT /notification-settings → flat dict
  update: async (settings: Partial<NotificationSettings>): Promise<void> => {
    await apiClient.put('/notification-settings', settings);
  },
};
