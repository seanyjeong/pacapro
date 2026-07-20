import { getSafeApiToastMessage } from '@/lib/api/error-message';

const SETTINGS_SAVE_FALLBACK = '설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.';

export function getSettingsSaveErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return SETTINGS_SAVE_FALLBACK;
  }

  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  const message = response?.data?.message;
  return typeof message === 'string'
    ? getSafeApiToastMessage(message)
    : SETTINGS_SAVE_FALLBACK;
}
