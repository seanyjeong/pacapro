import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { SeasonDetailResponse, SeasonEnrollResult } from '@/lib/types/season';
import type { SeasonEnrollPayload, SeasonEnrollStudent } from './season-enroll-types';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export async function fetchSeasonForEnrollment(seasonId: number): Promise<SeasonDetailResponse> {
  return apiClient.get<SeasonDetailResponse>(`/seasons/${seasonId}`, QUIET_REQUEST);
}

export async function fetchSeasonEligibleStudents(): Promise<SeasonEnrollStudent[]> {
  const response = await apiClient.get<{ students: SeasonEnrollStudent[] }>('/students?grade_type=high', QUIET_REQUEST);
  return response.students ?? [];
}

export async function registerSeasonStudent(seasonId: number, payload: SeasonEnrollPayload): Promise<SeasonEnrollResult> {
  return apiClient.post<SeasonEnrollResult>(`/seasons/${seasonId}/enroll`, payload, QUIET_REQUEST);
}
