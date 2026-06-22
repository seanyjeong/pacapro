import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { TimeSlot } from '@/lib/types/season';
import type {
  EnrolledStudentsResponse,
  SeasonDetailResponse,
  SeasonRefundCancelResponse,
  SeasonRefundPreview,
} from './season-detail-types';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export function fetchSeasonDetail(seasonId: number): Promise<SeasonDetailResponse> {
  return apiClient.get<SeasonDetailResponse>(`/seasons/${seasonId}`, QUIET_REQUEST);
}

export async function fetchEnrolledStudents(seasonId: number) {
  const response = await apiClient.get<EnrolledStudentsResponse>(`/seasons/${seasonId}/students`, QUIET_REQUEST);
  return response.enrolled_students ?? [];
}

export function removeSeason(seasonId: number): Promise<void> {
  return apiClient.delete<void>(`/seasons/${seasonId}`, QUIET_REQUEST);
}

export function removeEnrollment(seasonId: number, studentId: number): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/seasons/${seasonId}/students/${studentId}`, QUIET_REQUEST);
}

export function updateEnrollmentTimeSlots(enrollmentId: number, timeSlots: TimeSlot[]) {
  return apiClient.put<{ message: string }>(
    `/seasons/enrollments/${enrollmentId}`,
    { time_slots: timeSlots },
    QUIET_REQUEST
  );
}

export function fetchRefundPreview(enrollmentId: number, cancellationDate: string): Promise<SeasonRefundPreview> {
  return apiClient.post<SeasonRefundPreview>(
    `/seasons/enrollments/${enrollmentId}/refund-preview`,
    { cancellation_date: cancellationDate, include_vat: false },
    QUIET_REQUEST
  );
}

export function cancelEnrollmentWithRefund(
  enrollmentId: number,
  cancellationDate: string,
  includeVat: boolean,
  finalRefundAmount: number
): Promise<SeasonRefundCancelResponse> {
  return apiClient.post<SeasonRefundCancelResponse>(
    `/seasons/enrollments/${enrollmentId}/cancel`,
    {
      cancellation_date: cancellationDate,
      include_vat: includeVat,
      final_refund_amount: finalRefundAmount,
    },
    QUIET_REQUEST
  );
}
