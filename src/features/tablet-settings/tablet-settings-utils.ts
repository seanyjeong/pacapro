import packageJson from '../../../package.json';
import type { NotificationSettings } from '@/lib/api/notificationSettings';

export const DEFAULT_TABLET_NOTIFICATION_SETTINGS: NotificationSettings = {
  unpaid_attendance: true,
  consultation_reminder: true,
  new_consultation: true,
  pause_ending: true,
};

export const TABLET_APP_VERSION = `v${packageJson.version}`;

export function getTabletRoleLabel(role?: string): string {
  const labels: Record<string, string> = {
    admin: '관리자',
    instructor: '강사',
    owner: '원장',
    staff: '직원',
  };
  return role ? labels[role] || role : '권한 미확인';
}

export function getTabletRoleTone(role?: string): string {
  const tones: Record<string, string> = {
    admin: 'border-sky-200 bg-sky-50 text-sky-800',
    instructor: 'border-amber-200 bg-amber-50 text-amber-800',
    owner: 'border-violet-200 bg-violet-50 text-violet-800',
    staff: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return role ? tones[role] || 'border-border bg-muted text-foreground' : 'border-border bg-muted text-foreground';
}

export function getTabletDeviceName(): string {
  if (typeof navigator === 'undefined') return '태블릿';
  const userAgent = navigator.userAgent;
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android Tablet';
  return '태블릿';
}

export function isTabletPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return 'serviceWorker' in navigator && typeof window.PushManager !== 'undefined' && typeof window.Notification !== 'undefined';
}

export function getActiveNotificationCount(settings: NotificationSettings): number {
  return Object.values(settings).filter(Boolean).length;
}

export async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 1200): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}
