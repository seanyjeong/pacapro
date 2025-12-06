import apiClient from './client';
import type {
  Consultation,
  ConsultationFormData,
  ConsultationListResponse,
  ConsultationPageInfo,
  SlotsResponse,
  SettingsResponse,
  WeeklyHour,
  ConsultationStatus
} from '../types/consultation';

// ============================================
// 공개 API (인증 불필요)
// ============================================

// 학원 상담 페이지 정보 조회
export async function getConsultationPageInfo(slug: string): Promise<ConsultationPageInfo> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/consultation/${slug}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '페이지 정보를 불러올 수 없습니다.');
  }
  return response.json();
}

// 특정 날짜의 가능한 슬롯 조회
export async function getAvailableSlots(slug: string, date: string): Promise<SlotsResponse> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/public/consultation/${slug}/slots?date=${date}`
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '시간 정보를 불러올 수 없습니다.');
  }
  return response.json();
}

// 상담 신청
export async function submitConsultation(
  slug: string,
  data: ConsultationFormData
): Promise<{ message: string; consultationId: number }> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/public/consultation/${slug}/apply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '상담 신청에 실패했습니다.');
  }
  return response.json();
}

// slug 사용 가능 여부 확인
export async function checkSlugAvailability(
  slug: string
): Promise<{ available: boolean; message?: string }> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/public/check-slug/${slug}`
  );
  return response.json();
}

// ============================================
// 관리자 API (인증 필요)
// ============================================

// 상담 목록 조회
export async function getConsultations(params?: {
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  consultationType?: string;
  page?: number;
  limit?: number;
}): Promise<ConsultationListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.consultationType) searchParams.append('consultationType', params.consultationType);
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  return apiClient.get<ConsultationListResponse>(`/consultations?${searchParams.toString()}`);
}

// 상담 상세 조회
export async function getConsultation(id: number): Promise<Consultation> {
  return apiClient.get<Consultation>(`/consultations/${id}`);
}

// 상담 수정 (상태, 메모, 일정, 체크리스트)
export async function updateConsultation(
  id: number,
  data: {
    status?: ConsultationStatus;
    adminNotes?: string;
    preferredDate?: string;
    preferredTime?: string;
    checklist?: { id: number; text: string; checked: boolean }[];
    consultationMemo?: string;
  }
): Promise<{ message: string }> {
  return apiClient.put<{ message: string }>(`/consultations/${id}`, data);
}

// 상담 삭제
export async function deleteConsultation(id: number): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/consultations/${id}`);
}

// 기존 학생과 연결
export async function linkStudent(
  consultationId: number,
  studentId: number
): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>(`/consultations/${consultationId}/link-student`, {
    studentId
  });
}

// ============================================
// 상담 설정 API
// ============================================

// 상담 설정 조회
export async function getConsultationSettings(): Promise<SettingsResponse> {
  return apiClient.get<SettingsResponse>('/consultations/settings/info');
}

// 상담 설정 수정
export async function updateConsultationSettings(data: {
  slug?: string;
  isEnabled?: boolean;
  pageTitle?: string;
  pageDescription?: string;
  slotDuration?: number;
  maxReservationsPerSlot?: number;
  advanceDays?: number;
  referralSources?: string[];
  sendConfirmationAlimtalk?: boolean;
  confirmationTemplateCode?: string;
}): Promise<{ message: string }> {
  return apiClient.put<{ message: string }>('/consultations/settings/info', data);
}

// 요일별 운영 시간 수정
export async function updateWeeklyHours(
  weeklyHours: WeeklyHour[]
): Promise<{ message: string }> {
  return apiClient.put<{ message: string }>('/consultations/settings/weekly-hours', {
    weeklyHours
  });
}

// 시간대 차단 추가
export async function addBlockedSlot(data: {
  blockedDate: string;
  isAllDay?: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}): Promise<{ message: string; id: number }> {
  return apiClient.post<{ message: string; id: number }>('/consultations/settings/blocked-slots', data);
}

// 시간대 차단 해제
export async function removeBlockedSlot(id: number): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/consultations/settings/blocked-slots/${id}`);
}

// 캘린더용 상담 일정 조회
export async function getCalendarEvents(
  startDate: string,
  endDate: string
): Promise<{ events: Record<string, Consultation[]> }> {
  return apiClient.get<{ events: Record<string, Consultation[]> }>(
    `/consultations/calendar/events?startDate=${startDate}&endDate=${endDate}`
  );
}

// 관리자 직접 상담 등록
export async function createDirectConsultation(data: {
  studentName: string;
  phone: string;
  grade: string;
  preferredDate: string;
  preferredTime: string;
  notes?: string;
}): Promise<{ message: string; id: number }> {
  return apiClient.post<{ message: string; id: number }>('/consultations/direct', data);
}

// 상담 완료 → 체험 학생 등록
export async function convertToTrialStudent(
  consultationId: number,
  trialDates: { date: string; timeSlot: string }[]
): Promise<{ message: string; studentId: number }> {
  return apiClient.post<{ message: string; studentId: number }>(
    `/consultations/${consultationId}/convert-to-trial`,
    { trialDates }
  );
}
