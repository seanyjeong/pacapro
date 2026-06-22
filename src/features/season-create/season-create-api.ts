import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { SeasonCreateResponse, SeasonFormData } from '@/lib/types/season';
import { buildSeasonCreatePayload } from './season-create-utils';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export async function createSeasonFromForm(formData: SeasonFormData): Promise<SeasonCreateResponse> {
  return apiClient.post<SeasonCreateResponse>('/seasons', buildSeasonCreatePayload(formData), QUIET_REQUEST);
}
