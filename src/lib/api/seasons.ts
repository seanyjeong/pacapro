/**
 * 시즌 관리 API 클라이언트
 */

import apiClient from './client';
import type {
  Season,
  SeasonFormData,
  SeasonFilters,
  StudentSeason,
  SeasonEnrollData,
  ProRatedPreview,
  SeasonEnrollResult,
  SeasonsResponse,
  SeasonDetailResponse,
  SeasonCreateResponse,
  SeasonUpdateResponse,
} from '@/lib/types/season';

const BASE_PATH = '/seasons';

export const seasonsApi = {
  /**
   * 시즌 목록 조회
   */
  getSeasons: async (filters?: SeasonFilters): Promise<Season[]> => {
    const params = new URLSearchParams();

    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.season_type) params.append('season_type', filters.season_type);
    if (filters?.status) params.append('status', filters.status);

    const queryString = params.toString();
    const url = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;

    const response = await apiClient.get<SeasonsResponse>(url);
    return response.seasons || [];
  },

  /**
   * 활성 시즌 목록 조회
   */
  getActiveSeasons: async (): Promise<Season[]> => {
    const response = await apiClient.get<SeasonsResponse>(`${BASE_PATH}/active`);
    return response.seasons || [];
  },

  /**
   * 시즌 상세 조회
   */
  getSeason: async (id: number): Promise<SeasonDetailResponse> => {
    return apiClient.get<SeasonDetailResponse>(`${BASE_PATH}/${id}`);
  },

  /**
   * 시즌 생성
   */
  createSeason: async (data: SeasonFormData): Promise<Season> => {
    // non_season_end_date가 없으면 start_date 하루 전으로 자동 설정
    let nonSeasonEndDate = data.non_season_end_date;
    if (!nonSeasonEndDate && data.start_date) {
      const startDate = new Date(data.start_date);
      startDate.setDate(startDate.getDate() - 1);
      nonSeasonEndDate = startDate.toISOString().split('T')[0];
    }

    // 프론트엔드 필드명을 백엔드 필드명으로 변환
    const apiData = {
      season_name: data.season_name,
      season_type: data.season_type,
      season_start_date: data.start_date,
      season_end_date: data.end_date,
      non_season_end_date: nonSeasonEndDate,
      operating_days: data.operating_days,
      grade_time_slots: data.grade_time_slots,
      default_season_fee: data.season_fee,
      continuous_discount_type: data.continuous_discount_type,
      continuous_discount_rate: data.continuous_discount_rate,
    };
    const response = await apiClient.post<SeasonCreateResponse>(BASE_PATH, apiData);
    return response.season;
  },

  /**
   * 시즌 수정
   */
  updateSeason: async (id: number, data: Partial<SeasonFormData>): Promise<Season> => {
    // 프론트엔드 필드명을 백엔드 필드명으로 변환
    const apiData: Record<string, unknown> = {};

    if (data.season_name !== undefined) apiData.season_name = data.season_name;
    if (data.season_type !== undefined) apiData.season_type = data.season_type;
    if (data.start_date !== undefined) apiData.season_start_date = data.start_date;
    if (data.end_date !== undefined) apiData.season_end_date = data.end_date;
    if (data.non_season_end_date !== undefined) apiData.non_season_end_date = data.non_season_end_date;
    if (data.operating_days !== undefined) apiData.operating_days = data.operating_days;
    if (data.grade_time_slots !== undefined) apiData.grade_time_slots = data.grade_time_slots;
    if (data.season_fee !== undefined) apiData.default_season_fee = data.season_fee;
    if (data.continuous_discount_type !== undefined) apiData.continuous_discount_type = data.continuous_discount_type;
    if (data.continuous_discount_rate !== undefined) apiData.continuous_discount_rate = data.continuous_discount_rate;
    if (data.status !== undefined) apiData.status = data.status;

    const response = await apiClient.put<SeasonUpdateResponse>(`${BASE_PATH}/${id}`, apiData);
    return response.season;
  },

  /**
   * 시즌 삭제
   */
  deleteSeason: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`${BASE_PATH}/${id}`);
  },

  /**
   * 일할계산 미리보기
   */
  getProRatedPreview: async (
    seasonId: number,
    studentId: number,
    isContinuous?: boolean,
    previousSeasonId?: number,
    registrationDate?: string  // 시즌 중간 합류 시 등록일
  ): Promise<ProRatedPreview> => {
    const params = new URLSearchParams();
    params.append('student_id', studentId.toString());
    if (isContinuous) params.append('is_continuous', 'true');
    if (previousSeasonId) params.append('previous_season_id', previousSeasonId.toString());
    if (registrationDate) params.append('registration_date', registrationDate);

    const response = await apiClient.get<{ message: string; preview: ProRatedPreview }>(
      `${BASE_PATH}/${seasonId}/preview?${params.toString()}`
    );
    return response.preview;
  },

  /**
   * 시즌 등록 (학생을 시즌에 등록)
   */
  enrollStudent: async (seasonId: number, data: SeasonEnrollData): Promise<SeasonEnrollResult> => {
    return apiClient.post<SeasonEnrollResult>(`${BASE_PATH}/${seasonId}/enroll`, data);
  },

  /**
   * 시즌 등록 정보 수정 (등록일, 시즌비, 할인, 시간대)
   */
  updateEnrollment: async (
    enrollmentId: number,
    data: {
      registration_date?: string;
      season_fee?: number;
      discount_amount?: number;
      discount_reason?: string;
      time_slots?: string[];
    }
  ): Promise<{ message: string; enrollment: StudentSeason }> => {
    return apiClient.put<{ message: string; enrollment: StudentSeason }>(
      `${BASE_PATH}/enrollments/${enrollmentId}`,
      data
    );
  },

  /**
   * 시즌 등록 취소
   */
  cancelEnrollment: async (seasonId: number, studentId: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`${BASE_PATH}/${seasonId}/students/${studentId}`);
  },

  /**
   * 시즌 등록 학생 목록 조회
   */
  getEnrolledStudents: async (seasonId: number): Promise<StudentSeason[]> => {
    const response = await apiClient.get<{ enrolled_students: StudentSeason[] }>(
      `${BASE_PATH}/${seasonId}/students`
    );
    return response.enrolled_students || [];
  },

  /**
   * 학생의 시즌 등록 이력 조회
   */
  getStudentSeasonHistory: async (studentId: number): Promise<StudentSeason[]> => {
    const response = await apiClient.get<{ seasons: StudentSeason[] }>(
      `/students/${studentId}/seasons`
    );
    return response.seasons || [];
  },
};

export default seasonsApi;
