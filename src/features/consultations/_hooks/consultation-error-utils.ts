import type { APIRequestConfig } from '@/lib/api/client';

export const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

const RAW_TECHNICAL_ERROR_PATTERN =
  /(Failed to load|CORS|Axios|stack trace|DB timeout|HTTP\s*(400|401|403|404|500)|status\s*(400|401|403|404|500))/i;

export function getConsultationErrorText(error: unknown, fallback: string): string {
  const responseText = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  const rawText = responseText?.message || responseText?.error || (error as { message?: string })?.message || '';
  if (!rawText || RAW_TECHNICAL_ERROR_PATTERN.test(rawText)) return fallback;
  return rawText;
}
