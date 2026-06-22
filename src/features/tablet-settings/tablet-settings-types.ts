import type { NotificationSettings } from '@/lib/api/notificationSettings';

export interface TabletSettingsUser {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  academy_name?: string;
}

export type TabletSettingsNotice = {
  message: string;
  tone: 'success' | 'error' | 'info';
} | null;

export type NotificationSettingKey = keyof NotificationSettings;
