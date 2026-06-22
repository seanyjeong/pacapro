import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { Season, SeasonFilters, SeasonsResponse } from '@/lib/types/season';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export async function fetchSeasonsForList(filters: SeasonFilters): Promise<Season[]> {
  const params = new URLSearchParams();
  if (filters.year) params.append('year', filters.year.toString());
  if (filters.season_type) params.append('season_type', filters.season_type);
  if (filters.status) params.append('status', filters.status);

  const query = params.toString();
  const response = await apiClient.get<SeasonsResponse>(`/seasons${query ? `?${query}` : ''}`, QUIET_REQUEST);
  return response.seasons ?? [];
}

export function deleteSeasonFromList(seasonId: number): Promise<void> {
  return apiClient.delete<void>(`/seasons/${seasonId}`, QUIET_REQUEST);
}
