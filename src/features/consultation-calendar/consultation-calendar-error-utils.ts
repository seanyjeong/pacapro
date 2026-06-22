import type { APIRequestConfig } from '@/lib/api/client';

export const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export function getCalendarErrorMessage() {
  return '잠시 후 다시 시도해주세요.';
}
