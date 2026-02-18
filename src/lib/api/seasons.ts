/**
 * 시즌 관리 API 클라이언트
 * Backend: FastAPI seasons router
 */

import apiClient from './client';
import type {
  Season,
  SeasonFormData,
  SeasonFilters,
  StudentSeason,
  SeasonEnrollData,
  EnrollmentUpdateData,
  SeasonPreviewResponse,
  RefundPreviewResponse,
} from '@/lib/types/season';

const BASE_PATH = '/seasons';

// Backend → Frontend alias mapping
function mapSeason(raw: Record<string, unknown>): Season {
  const s = raw as unknown as Season;
  return {
    ...s,
    // Backward-compat aliases
    season_name: s.name,
    season_start_date: s.start_date,
    season_end_date: s.end_date,
    default_season_fee: String(s.fee ?? 0),
  };
}

function mapStudentSeason(raw: Record<string, unknown>): StudentSeason {
  const ss = raw as unknown as StudentSeason;
  return {
    ...ss,
    // Backward-compat aliases
    season_fee: String(ss.fee ?? 0),
    registration_date: ss.enrollment_date,
    registered_at: ss.created_at,
    // Map nested season if present (from student history endpoint)
    season: ss.season ? mapSeason(ss.season as unknown as Record<string, unknown>) : undefined,
  };
}

export const seasonsApi = {
  /**
   * 시즌 목록 조회
   * Backend: GET /seasons → flat array
   */
  getSeasons: async (filters?: SeasonFilters): Promise<Season[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);

    const queryString = params.toString();
    const url = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;

    const response = await apiClient.get<Record<string, unknown>[]>(url);
    return (response || []).map(mapSeason);
  },

  /**
   * 활성 시즌 조회
   * Backend: GET /seasons/active → single object (404 if none)
   */
  getActiveSeason: async (): Promise<Season | null> => {
    try {
      const response = await apiClient.get<Record<string, unknown>>(`${BASE_PATH}/active`);
      return mapSeason(response);
    } catch {
      return null;
    }
  },

  /**
   * 시즌 상세 조회
   * Backend: GET /seasons/{id} → flat dict
   */
  getSeason: async (id: number): Promise<Season> => {
    const response = await apiClient.get<Record<string, unknown>>(`${BASE_PATH}/${id}`);
    return mapSeason(response);
  },

  /**
   * 시즌 생성
   * Backend: POST /seasons → SeasonCreate { name, start_date, end_date, fee, description }
   */
  createSeason: async (data: SeasonFormData): Promise<Season> => {
    const apiData = {
      name: data.season_name,
      start_date: data.start_date,
      end_date: data.end_date,
      fee: data.season_fee || 0,
      description: data.notes,
    };
    const response = await apiClient.post<Record<string, unknown>>(BASE_PATH, apiData);
    return mapSeason(response);
  },

  /**
   * 시즌 수정
   * Backend: PUT /seasons/{id} → SeasonUpdate { name?, start_date?, end_date?, fee?, description?, status? }
   */
  updateSeason: async (id: number, data: Partial<SeasonFormData>): Promise<Season> => {
    const apiData: Record<string, unknown> = {};

    if (data.season_name !== undefined) apiData.name = data.season_name;
    if (data.start_date !== undefined) apiData.start_date = data.start_date;
    if (data.end_date !== undefined) apiData.end_date = data.end_date;
    if (data.season_fee !== undefined) apiData.fee = data.season_fee;
    if (data.notes !== undefined) apiData.description = data.notes;
    if (data.status !== undefined) apiData.status = data.status;

    const response = await apiClient.put<Record<string, unknown>>(`${BASE_PATH}/${id}`, apiData);
    return mapSeason(response);
  },

  /**
   * 시즌 삭제
   * Backend: DELETE /seasons/{id}
   */
  deleteSeason: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`${BASE_PATH}/${id}`);
  },

  /**
   * 시즌 미리보기 (통계)
   * Backend: GET /seasons/{id}/preview → { season, stats }
   */
  getSeasonPreview: async (seasonId: number): Promise<SeasonPreviewResponse> => {
    const response = await apiClient.get<{ season: Record<string, unknown>; stats: SeasonPreviewResponse['stats'] }>(
      `${BASE_PATH}/${seasonId}/preview`
    );
    return {
      season: mapSeason(response.season),
      stats: response.stats,
    };
  },

  /**
   * 학생 등록
   * Backend: POST /seasons/{id}/enroll → SeasonEnroll { student_id, fee, enrollment_date? }
   */
  enrollStudent: async (seasonId: number, data: SeasonEnrollData): Promise<StudentSeason> => {
    const response = await apiClient.post<Record<string, unknown>>(`${BASE_PATH}/${seasonId}/enroll`, data);
    return mapStudentSeason(response);
  },

  /**
   * 대량 등록
   * Backend: POST /seasons/{id}/bulk-enroll → BulkEnroll { student_ids, fee }
   */
  bulkEnroll: async (
    seasonId: number,
    data: { student_ids: number[]; fee?: number }
  ): Promise<{ enrolled_count: number; enrolled_student_ids: number[] }> => {
    return apiClient.post(`${BASE_PATH}/${seasonId}/bulk-enroll`, data);
  },

  /**
   * 등록 정보 수정 (by season_id + student_id)
   * Backend: PUT /seasons/{seasonId}/students/{studentId} → EnrollmentUpdate
   */
  updateEnrollment: async (
    seasonId: number,
    studentId: number,
    data: EnrollmentUpdateData
  ): Promise<StudentSeason> => {
    const response = await apiClient.put<Record<string, unknown>>(
      `${BASE_PATH}/${seasonId}/students/${studentId}`,
      data
    );
    return mapStudentSeason(response);
  },

  /**
   * 등록 정보 수정 (by enrollment id)
   * Backend: PUT /enrollments/{enrollmentId} → EnrollmentUpdate
   */
  updateEnrollmentById: async (
    enrollmentId: number,
    data: EnrollmentUpdateData & Record<string, unknown>
  ): Promise<StudentSeason> => {
    const response = await apiClient.put<Record<string, unknown>>(
      `${BASE_PATH}/enrollments/${enrollmentId}`,
      data
    );
    return mapStudentSeason(response);
  },

  /**
   * 등록 취소 (by season_id + student_id)
   * Backend: DELETE /seasons/{seasonId}/students/{studentId} → sets status=cancelled
   */
  cancelEnrollment: async (seasonId: number, studentId: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`${BASE_PATH}/${seasonId}/students/${studentId}`);
  },

  /**
   * 환불 미리보기
   * Backend: POST /enrollments/{enrollmentId}/refund-preview → no body
   */
  getRefundPreview: async (enrollmentId: number): Promise<RefundPreviewResponse> => {
    return apiClient.post<RefundPreviewResponse>(
      `${BASE_PATH}/enrollments/${enrollmentId}/refund-preview`,
      {}
    );
  },

  /**
   * 등록 취소 (by enrollment id)
   * Backend: POST /enrollments/{enrollmentId}/cancel → no body, sets status=cancelled
   */
  cancelEnrollmentById: async (enrollmentId: number): Promise<StudentSeason> => {
    const response = await apiClient.post<Record<string, unknown>>(
      `${BASE_PATH}/enrollments/${enrollmentId}/cancel`,
      {}
    );
    return mapStudentSeason(response);
  },

  /**
   * 시즌 등록 학생 목록
   * Backend: GET /seasons/{seasonId}/students → flat array
   */
  getEnrolledStudents: async (seasonId: number): Promise<StudentSeason[]> => {
    const response = await apiClient.get<Record<string, unknown>[]>(
      `${BASE_PATH}/${seasonId}/students`
    );
    return (response || []).map(mapStudentSeason);
  },

  /**
   * 학생의 시즌 이력
   * Backend: GET /students/{studentId}/seasons → [{...studentSeason, season: {...}}]
   */
  getStudentSeasonHistory: async (studentId: number): Promise<StudentSeason[]> => {
    const response = await apiClient.get<Record<string, unknown>[]>(
      `/students/${studentId}/seasons`
    );
    return (response || []).map(mapStudentSeason);
  },
};

export default seasonsApi;
