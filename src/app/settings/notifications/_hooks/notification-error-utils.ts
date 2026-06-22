import type { APIRequestConfig } from '@/lib/api/client';

export const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export type NotificationLoadErrorKey = 'academy' | 'settings' | 'logs' | 'senderNumbers';
export type NotificationLoadErrors = Partial<Record<NotificationLoadErrorKey, string>>;

export const NOTIFICATION_LOAD_ERROR_MESSAGES: Record<NotificationLoadErrorKey, string> = {
  academy: '학원 이름을 불러오지 못했습니다. 기본 이름으로 표시합니다.',
  settings: '알림톡 설정을 불러오지 못했습니다. 저장 전 현재 값을 다시 확인해주세요.',
  logs: '발송 내역을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.',
  senderNumbers: '발신번호 정보를 불러오지 못했습니다. 알림톡 설정에서 다시 확인해주세요.',
};

const RAW_TECHNICAL_ERROR_PATTERN =
  /(Failed to load|CORS|Axios|stack trace|DB timeout|HTTP\s*(400|401|403|404|500)|status\s*(400|401|403|404|500))/i;

export function getNotificationErrorText(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  const rawText = message?.message || message?.error || '';
  if (!rawText || RAW_TECHNICAL_ERROR_PATTERN.test(rawText)) return fallback;
  return rawText;
}
