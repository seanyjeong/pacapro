import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/ui/page';
import type { NotificationSettings } from '@/lib/api/notificationSettings';

export interface MobileHomeUser {
  name: string;
  academyName: string;
  role: string;
}

export interface MobileHomeMenuItem {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  tone: Tone;
  permission: boolean;
}

export interface MobilePushSettingItem {
  key: keyof NotificationSettings;
  icon: LucideIcon;
  title: string;
  description: string;
}
