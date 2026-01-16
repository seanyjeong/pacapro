/**
 * Students API Client
 * 학생 관련 API 호출 함수
 */

import apiClient from './client';
import type {
  Student,
  StudentFormData,
  StudentsResponse,
  StudentDetailResponse,
  StudentCreateResponse,
  StudentUpdateResponse,
  StudentDeleteResponse,
  StudentFilters,
  ManualCreditRequest,
  ManualCreditResponse,
  RestCreditsResponse,
} from '@/lib/types/student';

export const studentsAPI = {
  /**
   * 학생 목록 조회 (필터링)
   * GET /paca/students
   */
  getStudents: async (filters?: StudentFilters): Promise<StudentsResponse> => {
    const params = new URLSearchParams();

    if (filters?.student_type) params.append('student_type', filters.student_type);
    if (filters?.grade) params.append('grade', filters.grade);
    if (filters?.admission_type) params.append('admission_type', filters.admission_type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.gender) params.append('gender', filters.gender);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.is_trial !== undefined) params.append('is_trial', String(filters.is_trial));

    const queryString = params.toString();
    const url = queryString ? `/students?${queryString}` : '/students';

    return await apiClient.get(url);
  },

  /**
   * 학생 상세 조회
   * GET /paca/students/:id
   */
  getStudent: async (id: number): Promise<StudentDetailResponse> => {
    return await apiClient.get(`/students/${id}`);
  },

  /**
   * 학생 등록
   * POST /paca/students
   */
  createStudent: async (data: StudentFormData): Promise<StudentCreateResponse> => {
    // class_days는 배열 그대로 전송 (백엔드에서 JSON.stringify 처리)
    return await apiClient.post('/students', data);
  },

  /**
   * 학생 수정
   * PUT /paca/students/:id
   */
  updateStudent: async (id: number, data: Partial<StudentFormData>): Promise<StudentUpdateResponse> => {
    // class_days는 배열 그대로 전송 (백엔드에서 JSON.stringify 처리)
    return await apiClient.put(`/students/${id}`, data);
  },

  /**
   * 학생 삭제 (soft delete)
   * DELETE /paca/students/:id
   */
  deleteStudent: async (id: number): Promise<StudentDeleteResponse> => {
    return await apiClient.delete(`/students/${id}`);
  },

  /**
   * 학생 검색 (자동완성용)
   * GET /paca/students/search?q=query
   */
  searchStudents: async (query: string): Promise<StudentsResponse> => {
    return await apiClient.get(`/students/search?q=${encodeURIComponent(query)}`);
  },

  /**
   * 퇴원 처리
   * POST /paca/students/:id/withdraw
   */
  withdrawStudent: async (id: number, reason?: string, withdrawalDate?: string): Promise<{
    message: string;
    student: {
      id: number;
      name: string;
      status: string;
      withdrawal_date: string;
      withdrawal_reason: string | null;
    };
    withdrawalInfo?: {
      deletedPayments: number;
      totalUnpaidAmount: number;
      message: string;
    };
  }> => {
    return await apiClient.post(`/students/${id}/withdraw`, {
      reason,
      withdrawal_date: withdrawalDate
    });
  },

  /**
   * 학년 자동 진급
   * POST /paca/students/auto-promote
   * @param dryRun - true면 미리보기만
   * @param graduateStudentIds - 고3 중 졸업 처리할 학생 ID 배열
   */
  autoPromote: async (dryRun: boolean = false, graduateStudentIds: number[] = []): Promise<{
    message: string;
    dry_run: boolean;
    promoted: number;
    graduated: number;
    summary: Record<string, number>;
    details: Array<{
      studentId: number;
      name: string;
      from: string;
      to: string;
      action: 'promoted' | 'graduated';
    }>;
  }> => {
    return await apiClient.post('/students/auto-promote', {
      dry_run: dryRun,
      graduate_student_ids: graduateStudentIds
    });
  },

  /**
   * 휴원 종료 대기 학생 목록 조회
   * GET /paca/students/rest-ended
   */
  getRestEndedStudents: async (): Promise<{
    message: string;
    students: Array<{
      id: number;
      name: string;
      phone: string | null;
      school: string | null;
      grade: string | null;
      rest_start_date: string;
      rest_end_date: string;
      rest_reason: string | null;
      class_days: number[] | string;
      time_slot: string | null;
      monthly_tuition: string;
      discount_rate: string;
      days_overdue: number;
    }>;
  }> => {
    return await apiClient.get('/students/rest-ended');
  },

  /**
   * 학생 복귀 처리 (날짜 지정 가능)
   * POST /paca/students/:id/resume
   * @param id - 학생 ID
   * @param resumeDate - 복귀 날짜 (YYYY-MM-DD) - 없으면 오늘
   */
  resumeStudent: async (id: number, resumeDate?: string): Promise<{
    message: string;
    student: Student;
    scheduleAssigned: {
      assigned: number;
      created: number;
    } | null;
    paymentCreated: {
      id: number;
      yearMonth: string;
      baseAmount: number;
      finalAmount: number;
      remainingClassDays: number;
      totalClassDays: number;
    } | null;
    resumeDate: string;
  }> => {
    return await apiClient.post(`/students/${id}/resume`, {
      resume_date: resumeDate
    });
  },

  /**
   * 학생 크레딧 목록 조회
   * GET /paca/students/:id/rest-credits
   */
  getRestCredits: async (id: number): Promise<RestCreditsResponse> => {
    return await apiClient.get(`/students/${id}/rest-credits`);
  },

  /**
   * 수동 크레딧 생성
   * POST /paca/students/:id/manual-credit
   */
  createManualCredit: async (id: number, data: ManualCreditRequest): Promise<ManualCreditResponse> => {
    return await apiClient.post(`/students/${id}/manual-credit`, data);
  },

  /**
   * 학생 크레딧 목록 조회 (새 API)
   * GET /paca/students/:id/credits
   */
  getCredits: async (id: number): Promise<{ credits: any[] }> => {
    return await apiClient.get(`/students/${id}/credits`);
  },

  /**
   * 크레딧 수정
   * PUT /paca/students/:id/credits/:creditId
   */
  updateCredit: async (studentId: number, creditId: number, data: { credit_amount?: number; notes?: string; status?: string }): Promise<{ message: string }> => {
    return await apiClient.put(`/students/${studentId}/credits/${creditId}`, data);
  },

  /**
   * 크레딧 삭제
   * DELETE /paca/students/:id/credits/:creditId
   */
  deleteCredit: async (studentId: number, creditId: number): Promise<{ message: string }> => {
    return await apiClient.delete(`/students/${studentId}/credits/${creditId}`);
  },

  /**
   * 크레딧 수동 적용
   * POST /paca/students/:id/credits/:creditId/apply
   */
  applyCredit: async (studentId: number, creditId: number, yearMonth: string): Promise<{
    message: string;
    applied_amount: number;
    new_final_amount: number;
    credit_remaining: number;
  }> => {
    return await apiClient.post(`/students/${studentId}/credits/${creditId}/apply`, { year_month: yearMonth });
  },

  /**
   * 휴원 처리 (크레딧 옵션 포함)
   * POST /paca/students/:id/process-rest
   */
  processRest: async (id: number, data: {
    rest_start_date: string;
    rest_end_date?: string | null;
    rest_reason?: string;
    credit_type: 'carryover' | 'refund' | 'none';
    source_payment_id?: number;
  }): Promise<{
    message: string;
    student: Student;
    restCredit?: {
      id: number;
      credit_amount: number;
      credit_type: string;
      status: string;
    };
  }> => {
    return await apiClient.post(`/students/${id}/process-rest`, data);
  },
};
