import type { MobileHomeUser } from './mobile-home-types';

export function parseMobileHomeUser(): MobileHomeUser {
  const fallback = { name: '', academyName: '' };
  const userStr = window.localStorage.getItem('user');
  if (!userStr) return fallback;

  try {
    const user = JSON.parse(userStr);
    return {
      name: user.name || user.username || '',
      academyName: user.academy?.name || user.academy_name || '',
    };
  } catch {
    return fallback;
  }
}

export function formatTodayLabels() {
  const today = new Date();
  return {
    date: today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
    weekday: today.toLocaleDateString('ko-KR', { weekday: 'long' }),
  };
}

export function getDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return '모바일';
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timer));
  });
}
