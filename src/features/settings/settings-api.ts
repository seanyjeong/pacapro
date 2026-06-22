import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type {
  AcademySettings,
  AcademySettingsResponse,
  AuthMeResponse,
  OperationSettingsResponse,
  SettingsUser,
} from './settings-types';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export async function getCurrentUser(): Promise<SettingsUser> {
  const response = await apiClient.get<AuthMeResponse>('/auth/me', SILENT_CONFIG);
  return response.user;
}

export function getAcademySettings(): Promise<AcademySettingsResponse> {
  return apiClient.get<AcademySettingsResponse>('/settings/academy', SILENT_CONFIG);
}

export function getOperationSettings(): Promise<OperationSettingsResponse> {
  return apiClient.get<OperationSettingsResponse>('/settings', SILENT_CONFIG);
}

export function saveAcademySettings(settings: AcademySettings): Promise<unknown> {
  return apiClient.put<unknown>('/settings/academy', settings, SILENT_CONFIG);
}

export function saveOperationSettings(settings: AcademySettings): Promise<unknown> {
  return apiClient.put<unknown>(
    '/settings',
    {
      morning_class_time: settings.morning_class_time,
      afternoon_class_time: settings.afternoon_class_time,
      evening_class_time: settings.evening_class_time,
      salary_payment_day: settings.salary_payment_day,
      salary_month_type: settings.salary_month_type,
    },
    SILENT_CONFIG
  );
}

export function resetAllData(): Promise<unknown> {
  return apiClient.post<unknown>('/settings/reset-database', { confirmation: '초기화' }, SILENT_CONFIG);
}
