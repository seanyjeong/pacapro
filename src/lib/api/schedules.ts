/**
 * 수업 관리 API 클라이언트
 */

import apiClient from './client';
import type {
  ClassSchedule,
  Attendance,
  ScheduleFormData,
  ScheduleFilters,
  AttendanceBatchSubmission,
  ScheduleStats,
} from '@/lib/types/schedule';

const BASE_PATH = '/schedules';

export const schedulesApi = {
  /**
   * 수업 목록 조회
   */
  getSchedules: async (filters?: ScheduleFilters): Promise<ClassSchedule[]> => {
    const params = new URLSearchParams();

    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.instructor_id) params.append('instructor_id', filters.instructor_id.toString());
    if (filters?.time_slot) params.append('time_slot', filters.time_slot);
    if (filters?.attendance_taken !== undefined) {
      params.append('attendance_taken', filters.attendance_taken.toString());
    }

    const queryString = params.toString();
    const url = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;

    const response = await apiClient.get<{ schedules: ClassSchedule[] }>(url);
    return response.schedules || [];
  },

  /**
   * 수업 상세 조회
   */
  getSchedule: async (id: number): Promise<ClassSchedule> => {
    const response = await apiClient.get<{ schedule: ClassSchedule }>(`${BASE_PATH}/${id}`);
    return response.schedule;
  },

  /**
   * 수업 등록
   */
  createSchedule: async (data: ScheduleFormData): Promise<ClassSchedule> => {
    return apiClient.post<ClassSchedule>(BASE_PATH, data);
  },

  /**
   * 수업 수정
   */
  updateSchedule: async (id: number, data: Partial<ScheduleFormData>): Promise<ClassSchedule> => {
    return apiClient.put<ClassSchedule>(`${BASE_PATH}/${id}`, data);
  },

  /**
   * 수업 삭제
   */
  deleteSchedule: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`${BASE_PATH}/${id}`);
  },

  /**
   * 출석 현황 조회
   */
  getAttendance: async (scheduleId: number): Promise<{ schedule: ClassSchedule; students: Attendance[] }> => {
    return apiClient.get<{ schedule: ClassSchedule; students: Attendance[] }>(`${BASE_PATH}/${scheduleId}/attendance`);
  },

  /**
   * 출석 체크 (일괄 제출)
   */
  submitAttendance: async (
    scheduleId: number,
    data: AttendanceBatchSubmission
  ): Promise<void> => {
    return apiClient.post<void>(`${BASE_PATH}/${scheduleId}/attendance`, data);
  },

  /**
   * 수업 통계 조회
   */
  getStats: async (filters?: ScheduleFilters): Promise<ScheduleStats> => {
    const params = new URLSearchParams();

    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.instructor_id) params.append('instructor_id', filters.instructor_id.toString());

    const queryString = params.toString();
    const url = queryString ? `${BASE_PATH}/stats?${queryString}` : `${BASE_PATH}/stats`;

    return apiClient.get<ScheduleStats>(url);
  },

  /**
   * 강사 출근 현황 조회 (날짜 기준)
   */
  getInstructorAttendanceByDate: async (date: string): Promise<{
    date: string;
    attendances: InstructorAttendanceRecord[];
    instructors: { id: number; name: string }[];
    instructors_by_slot?: {
      morning: { id: number; name: string }[];
      afternoon: { id: number; name: string }[];
      evening: { id: number; name: string }[];
    };
  }> => {
    return apiClient.get(`${BASE_PATH}/date/${date}/instructor-attendance`);
  },

  /**
   * 강사 출근 체크 (날짜 기준)
   */
  submitInstructorAttendance: async (
    date: string,
    data: { attendances: InstructorAttendanceSubmission[] }
  ): Promise<void> => {
    return apiClient.post(`${BASE_PATH}/date/${date}/instructor-attendance`, data);
  },

  /**
   * 월별 강사 일정 통계 조회 (캘린더용)
   * 배정된 강사 수 + 출근한 강사 수
   */
  getMonthlyInstructorStats: async (
    year: number,
    month: number
  ): Promise<MonthlyInstructorStatsResponse> => {
    return apiClient.get(`${BASE_PATH}/instructor-schedules/month?year=${year}&month=${month + 1}`);
  },
};

// 강사 출근 기록 타입
export interface InstructorAttendanceRecord {
  id: number;
  instructor_id: number;
  instructor_name: string;
  time_slot: 'morning' | 'afternoon' | 'evening';
  attendance_status: 'present' | 'absent' | 'late' | 'half_day';
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
}

export interface InstructorAttendanceSubmission {
  instructor_id: number;
  time_slot: 'morning' | 'afternoon' | 'evening';
  attendance_status: 'present' | 'absent' | 'late' | 'half_day';
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
}

// 월별 강사 통계 응답 타입
export interface SlotInstructorCounts {
  scheduled: number;  // 배정된 강사 수
  attended: number;   // 출근한 강사 수
}

export interface DailyInstructorStats {
  morning: SlotInstructorCounts;
  afternoon: SlotInstructorCounts;
  evening: SlotInstructorCounts;
}

export interface MonthlyInstructorStatsResponse {
  message: string;
  year_month: string;
  schedules: Record<string, DailyInstructorStats>;  // { '2025-01-15': { morning: {...}, ... } }
}
