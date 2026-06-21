/**
 * Instructors API Client
 * 강사 관련 API 호출 함수
 */

import apiClient from './client';
import type {
  Instructor,
  InstructorFormData,
  InstructorsResponse,
  InstructorDetailResponse,
  InstructorCreateResponse,
  InstructorUpdateResponse,
  InstructorDeleteResponse,
  InstructorFilters,
} from '@/lib/types/instructor';

export const instructorsAPI = {
  /**
   * 강사 목록 조회 (필터링)
   * GET /paca/instructors
   */
  getInstructors: async (filters?: InstructorFilters): Promise<InstructorsResponse> => {
    const params = new URLSearchParams();

    if (filters?.status) params.append('status', filters.status);
    if (filters?.salary_type) params.append('salary_type', filters.salary_type);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = queryString ? `/instructors?${queryString}` : '/instructors';

    return await apiClient.get(url);
  },

  /**
   * 강사 상세 조회
   * GET /paca/instructors/:id
   */
  getInstructor: async (id: number): Promise<InstructorDetailResponse> => {
    return await apiClient.get(`/instructors/${id}`);
  },

  /**
   * 강사 등록
   * POST /paca/instructors
   */
  createInstructor: async (data: InstructorFormData): Promise<InstructorCreateResponse> => {
    return await apiClient.post('/instructors', data);
  },

  /**
   * 강사 수정
   * PUT /paca/instructors/:id
   */
  updateInstructor: async (id: number, data: Partial<InstructorFormData>): Promise<InstructorUpdateResponse> => {
    return await apiClient.put(`/instructors/${id}`, data);
  },

  /**
   * 강사 삭제 (soft delete)
   * DELETE /paca/instructors/:id
   */
  deleteInstructor: async (id: number): Promise<InstructorDeleteResponse> => {
    return await apiClient.delete(`/instructors/${id}`);
  },

  /**
   * 출퇴근 기록
   * POST /paca/instructors/:id/attendance
   */
  recordAttendance: async (
    id: number,
    data: {
      attendance_date: string;
      check_in?: string;
      check_out?: string;
      notes?: string;
    }
  ) => {
    return await apiClient.post(`/instructors/${id}/attendance`, data);
  },

  /**
   * 출퇴근 기록 조회
   * GET /paca/instructors/:id/attendance
   */
  getAttendances: async (id: number, year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());

    const queryString = params.toString();
    const url = queryString
      ? `/instructors/${id}/attendance?${queryString}`
      : `/instructors/${id}/attendance`;

    return await apiClient.get(url);
  },

  // ==========================================
  // 미배정 출근 요청 / 승인 관련
  // ==========================================

  /**
   * 미배정 출근 요청 생성
   * POST /paca/instructors/:id/overtime
   */
  requestExtraDay: async (
    instructorId: number,
    data: {
      work_date: string;
      time_slot: 'morning' | 'afternoon' | 'evening';
      request_type?: 'overtime' | 'extra_day';
      original_end_time?: string;  // 시급제: 예정 시작 시간
      actual_end_time?: string;    // 시급제: 예정 종료 시간
      notes?: string;
    }
  ): Promise<{ message: string; overtime: OvertimeApproval }> => {
    return await apiClient.post(`/instructors/${instructorId}/overtime`, {
      ...data,
      request_type: data.request_type || 'extra_day',
    });
  },

  /**
   * 대기 중인 승인 요청 조회
   * GET /paca/instructors/overtime/pending
   */
  getPendingOvertimes: async (): Promise<{ requests: OvertimeApproval[] }> => {
    return await apiClient.get('/instructors/overtime/pending');
  },

  /**
   * 승인 이력 조회
   * GET /paca/instructors/overtime/history
   */
  getOvertimeHistory: async (filters?: {
    year?: number;
    month?: number;
    instructor_id?: number;
  }): Promise<{ requests: OvertimeApproval[] }> => {
    const params = new URLSearchParams();
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.month) params.append('month', filters.month.toString());
    if (filters?.instructor_id) params.append('instructor_id', filters.instructor_id.toString());

    const queryString = params.toString();
    const url = queryString ? `/instructors/overtime/history?${queryString}` : '/instructors/overtime/history';

    return await apiClient.get(url);
  },

  /**
   * 승인/거부 처리
   * PUT /paca/instructors/overtime/:approvalId/approve
   */
  approveOvertime: async (
    approvalId: number,
    data: {
      status: 'approved' | 'rejected';
      notes?: string;
    }
  ): Promise<{ message: string; overtime: OvertimeApproval }> => {
    return await apiClient.put(`/instructors/overtime/${approvalId}/approve`, data);
  },
};

// 승인 요청 타입
export interface OvertimeApproval {
  id: number;
  academy_id: number;
  instructor_id: number;
  instructor_name?: string;
  work_date: string;
  time_slot: 'morning' | 'afternoon' | 'evening' | null;
  request_type: 'overtime' | 'extra_day';
  original_end_time?: string;
  actual_end_time?: string;
  overtime_minutes?: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
  salary_type?: string;
  hourly_rate?: number;
}
