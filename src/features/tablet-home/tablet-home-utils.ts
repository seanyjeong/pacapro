import type { TabletHomeAction, TabletHomeUser } from './tablet-home-types';

export function getTabletHomeUser(): TabletHomeUser | null {
  if (typeof window === 'undefined') return null;
  const rawUser = window.localStorage.getItem('user');
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser) as TabletHomeUser;
  } catch {
    return null;
  }
}

export function getTabletHomeAcademyName(user: TabletHomeUser | null): string {
  return user?.academy?.name || user?.academy_name || 'P-ACA';
}

export function getTabletHomeDateLabel(date = new Date()): string {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}

export function canUseTabletHomeAction(action: TabletHomeAction, user: TabletHomeUser | null): boolean {
  if (!action.permissionKey) return true;
  if (!user) return false;
  if (user.role === 'owner' || user.role === 'admin') return true;
  if (user.role !== 'staff') return false;
  return user.permissions?.[action.permissionKey]?.view === true;
}
