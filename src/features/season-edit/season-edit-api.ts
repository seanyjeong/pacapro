import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { SeasonDetailResponse, SeasonFormData, SeasonUpdateResponse } from '@/lib/types/season';
import { buildSeasonEditPayload } from './season-edit-utils';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export function fetchSeasonForEdit(seasonId: number): Promise<SeasonDetailResponse> {
  return apiClient.get<SeasonDetailResponse>(`/seasons/${seasonId}`, QUIET_REQUEST);
}

export function updateSeasonFromForm(seasonId: number, formData: SeasonFormData): Promise<SeasonUpdateResponse> {
  return apiClient.put<SeasonUpdateResponse>(`/seasons/${seasonId}`, buildSeasonEditPayload(formData), QUIET_REQUEST);
}
