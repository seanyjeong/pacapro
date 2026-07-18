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
  /(Failed to load|CORS|Axios|stack trace|DB timeout|HTTP\s*(400|401|403|404|429|500)|status\s*(400|401|403|404|429|500)|\b(400|401|403|404|429|500)\b|허용되지 않은\s*IP|forbidden|\b(?:\d{1,3}\.){3}\d{1,3}\b|ECONN|ETIMEDOUT|^[A-Z0-9]+(?:_[A-Z0-9]+)+$)/i;
const GENERIC_SEND_FAILURE_PATTERN =
  /^(fail(?:ed|ure)?|send\s*(fail(?:ed|ure)?|error)|발송에 실패했습니다[.:]?|알림톡 발송에 실패했습니다[.:]?|메시지 발송에 실패했습니다[.:]?|(?:[가-힣A-Za-z0-9]+\s+)*테스트(?:\s+메시지)?\s*발송에 실패했습니다[.:]?)$/i;
const FAILURE_DETAIL_KEYS = ['message', 'errorMessage', 'reason', 'details', 'error', 'description'] as const;

function collectFailureTexts(value: unknown, depth = 0): string[] {
  if (depth > 3 || value === null || value === undefined) return [];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  return FAILURE_DETAIL_KEYS.flatMap(key => collectFailureTexts(record[key], depth + 1));
}

function normalizeFailureReason(text: string): string | null {
  if (GENERIC_SEND_FAILURE_PATTERN.test(text)) return null;
  if (/허용되지 않은\s*IP|forbidden/i.test(text)) {
    return '발송 서비스의 보안 설정에서 현재 서버가 허용되지 않았습니다. 알림톡 연동 서비스의 접속 허용 설정을 확인해주세요.';
  }
  if (/[가-힣]/.test(text) && !RAW_TECHNICAL_ERROR_PATTERN.test(text)) return text;
  if (/template|템플릿/i.test(text)) {
    return '알림톡 템플릿 설정이 올바르지 않습니다. 승인된 템플릿과 입력한 내용을 확인해주세요.';
  }
  if (/unauthori[sz]ed|authentication|api\s*key|secret|인증/i.test(text)) {
    return '발송 서비스 인증 정보가 올바르지 않습니다. 알림톡 연동 설정을 다시 확인해주세요.';
  }
  if (/recipient|phone|수신|전화번호/i.test(text)) {
    return '받는 전화번호가 올바르지 않습니다. 전화번호를 확인해주세요.';
  }
  if (/insufficient|balance|잔액/i.test(text)) {
    return '발송 서비스 잔액이 부족합니다. 충전 상태를 확인해주세요.';
  }
  if (/timeout|network|연결/i.test(text)) {
    return '발송 서비스에 일시적으로 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  }
  return null;
}

export function getNotificationErrorText(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  const primaryMessage = typeof (data as { message?: unknown })?.message === 'string'
    ? (data as { message: string }).message.trim()
    : '';

  if (primaryMessage.includes('실패했습니다. 사유:') && !RAW_TECHNICAL_ERROR_PATTERN.test(primaryMessage)) {
    return primaryMessage;
  }

  for (const text of collectFailureTexts(data)) {
    const reason = normalizeFailureReason(text);
    if (reason) return `${fallback} 사유: ${reason}`;
  }
  return fallback;
}
