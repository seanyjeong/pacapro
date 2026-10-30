import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { ProRatedPreview, SeasonDetailResponse, SeasonEnrollResult } from '@/lib/types/season';
import type { SeasonEnrollPayload, SeasonEnrollStudent } from './season-enroll-types';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export async function fetchSeasonForEnrollment(seasonId: number): Promise<SeasonDetailResponse> {
  return apiClient.get<SeasonDetailResponse>(`/seasons/${seasonId}`, QUIET_REQUEST);
}

export async function fetchSeasonEligibleStudents(): Promise<SeasonEnrollStudent[]> {
  const query = new URLSearchParams({
    grade_type: 'high',
    status: 'active,paused',
    is_trial: 'false',
  });
  const response = await apiClient.get<{ students: SeasonEnrollStudent[] }>(`/students?${query}`, QUIET_REQUEST);
  return response.students ?? [];
}

// 등록과 같은 계산(오늘 등록 기준 시즌 도중 합류 일할 + 직접 할인)으로 실제 청구될 금액
export async function fetchSeasonEnrollPreview(
  seasonId: number,
  studentId: number,
  seasonFee: number,
  discountAmount: number
): Promise<ProRatedPreview> {
  const query = new URLSearchParams({
    student_id: String(studentId),
    season_fee: String(seasonFee),
    discount_amount: String(discountAmount),
  });
  const response = await apiClient.get<{ preview: ProRatedPreview }>(`/seasons/${seasonId}/preview?${query}`, QUIET_REQUEST);
  return response.preview;
}

export async function registerSeasonStudent(seasonId: number, payload: SeasonEnrollPayload): Promise<SeasonEnrollResult> {
  return apiClient.post<SeasonEnrollResult>(`/seasons/${seasonId}/enroll`, payload, QUIET_REQUEST);
}
