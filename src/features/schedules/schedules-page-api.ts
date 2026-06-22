import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { Consultation } from '@/lib/types/consultation';
import type { ClassSchedule, ScheduleFilters } from '@/lib/types/schedule';
import type { DailyInstructorStats } from '@/lib/api/schedules';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export async function fetchSchedulesForPage(filters: ScheduleFilters): Promise<ClassSchedule[]> {
  const params = new URLSearchParams();
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.instructor_id) params.append('instructor_id', filters.instructor_id.toString());
  if (filters.time_slot) params.append('time_slot', filters.time_slot);
  if (filters.attendance_taken !== undefined) params.append('attendance_taken', String(filters.attendance_taken));

  const query = params.toString();
  const response = await apiClient.get<{ schedules: ClassSchedule[] }>(`/schedules${query ? `?${query}` : ''}`, QUIET_REQUEST);
  return response.schedules ?? [];
}

export function deleteScheduleForPage(scheduleId: number): Promise<void> {
  return apiClient.delete<void>(`/schedules/${scheduleId}`, QUIET_REQUEST);
}

export async function fetchMonthlyInstructorStats(
  year: number,
  month: number
): Promise<Record<string, DailyInstructorStats>> {
  const response = await apiClient.get<{ schedules: Record<string, DailyInstructorStats> }>(
    `/schedules/instructor-schedules/month?year=${year}&month=${month + 1}`,
    QUIET_REQUEST
  );
  return response.schedules ?? {};
}

export async function fetchConsultationEvents(startDate: string, endDate: string): Promise<Record<string, Consultation[]>> {
  const response = await apiClient.get<{ events: Record<string, Consultation[]> }>(
    `/consultations/calendar/events?startDate=${startDate}&endDate=${endDate}`,
    QUIET_REQUEST
  );
  return response.events ?? {};
}

export async function fetchPendingOvertimeCount(): Promise<number> {
  const response = await apiClient.get<{ requests?: unknown[] }>('/instructors/overtime/pending', QUIET_REQUEST);
  return response.requests?.length ?? 0;
}
