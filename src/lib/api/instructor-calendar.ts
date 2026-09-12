import apiClient, { type APIRequestConfig } from './client';

export type InstructorCalendarSlot = 'morning' | 'afternoon' | 'evening';

export interface InstructorCalendarSchedule {
  id: number;
  instructor_id: number;
  instructor_name: string;
  work_date: string;
  time_slot: InstructorCalendarSlot;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
}

export interface InstructorCalendarResponse {
  year_month: string;
  instructors: { id: number; name: string }[];
  schedules: InstructorCalendarSchedule[];
}

export function getInstructorCalendar(month: string, config?: APIRequestConfig): Promise<InstructorCalendarResponse> {
  const [year, monthNumber] = month.split('-');
  return apiClient.get(`/schedules/instructor-schedules/calendar?year=${year}&month=${Number(monthNumber)}`, config);
}
