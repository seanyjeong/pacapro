const TECHNICAL_ERROR_PATTERN =
  /(Failed to load|CORS|Axios|stack trace|DB timeout|HTTP\s*(400|401|403|404|500)|status\s*(400|401|403|404|500))/i;

const DEFAULT_API_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';

export function getSafeApiToastMessage(message: unknown) {
  if (typeof message !== 'string') return DEFAULT_API_ERROR_MESSAGE;

  const trimmedMessage = message.trim();
  if (!trimmedMessage) return DEFAULT_API_ERROR_MESSAGE;

  return TECHNICAL_ERROR_PATTERN.test(trimmedMessage)
    ? DEFAULT_API_ERROR_MESSAGE
    : trimmedMessage;
}
