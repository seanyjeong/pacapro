import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { AttendanceSearchStudent } from './attendance-checker-types';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export async function searchAttendanceStudents(query: string): Promise<AttendanceSearchStudent[]> {
  const params = new URLSearchParams({
    search: query,
    status: 'active',
    limit: '20',
  });
  const response = await apiClient.get<{ students: AttendanceSearchStudent[] }>(
    `/students?${params.toString()}`,
    SILENT_CONFIG
  );
  return response.students || [];
}

export function addAttendanceMakeupStudent(
  date: string,
  timeSlot: string,
  studentId: number
): Promise<void> {
  return apiClient.post<void>(
    '/schedules/slot/student',
    {
      date,
      time_slot: timeSlot,
      student_id: studentId,
      is_makeup: true,
    },
    SILENT_CONFIG
  );
}
