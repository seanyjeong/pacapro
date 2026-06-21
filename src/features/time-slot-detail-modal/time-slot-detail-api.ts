import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { TimeSlot } from '@/lib/types/schedule';
import type {
  InstructorAttendanceResponse,
  InstructorAttendanceSubmission,
  SearchStudent,
  SlotDataResponse,
  StudentAttendanceSubmission,
} from './time-slot-detail-types';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export function getSlotData(date: string, timeSlot: TimeSlot): Promise<SlotDataResponse> {
  const params = new URLSearchParams({ date, time_slot: timeSlot });
  return apiClient.get<SlotDataResponse>(`/schedules/slot?${params.toString()}`, SILENT_CONFIG);
}

export function getInstructorAttendance(date: string): Promise<InstructorAttendanceResponse> {
  return apiClient.get<InstructorAttendanceResponse>(
    `/schedules/date/${date}/instructor-attendance`,
    SILENT_CONFIG
  );
}

export function saveInstructorAttendance(
  date: string,
  attendances: InstructorAttendanceSubmission[]
): Promise<void> {
  return apiClient.post<void>(
    `/schedules/date/${date}/instructor-attendance`,
    { attendances },
    SILENT_CONFIG
  );
}

export function moveSlotStudent(
  date: string,
  fromSlot: TimeSlot,
  toSlot: TimeSlot,
  studentId: number
): Promise<void> {
  return apiClient.post<void>(
    '/schedules/slot/move',
    {
      date,
      from_slot: fromSlot,
      to_slot: toSlot,
      student_id: studentId,
    },
    SILENT_CONFIG
  );
}

export function saveStudentAttendance(
  scheduleId: number,
  attendanceRecords: StudentAttendanceSubmission[]
): Promise<void> {
  return apiClient.post<void>(
    `/schedules/${scheduleId}/attendance`,
    { attendance_records: attendanceRecords },
    SILENT_CONFIG
  );
}

export async function searchActiveStudents(query: string): Promise<SearchStudent[]> {
  const params = new URLSearchParams({
    search: query,
    status: 'active',
    limit: '10',
  });
  const response = await apiClient.get<{ students: SearchStudent[] }>(
    `/students?${params.toString()}`,
    SILENT_CONFIG
  );
  return response.students;
}

export function addMakeupStudent(
  date: string,
  timeSlot: TimeSlot,
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
