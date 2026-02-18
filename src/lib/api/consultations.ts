/**
 * Consultations API Client
 * Aligned with FastAPI backend (api/app/routers/academy/consultations)
 *
 * Key mappings:
 * - Backend: date/time/notes → Frontend alias: preferred_date/preferred_time/admin_notes
 * - Backend returns flat arrays/objects (no wrapper)
 * - Settings endpoint: /consultations/settings (not /settings/info)
 * - Calendar events: year_month param (not startDate/endDate)
 */

import apiClient from './client';
import type {
  Consultation,
  ConsultationFormData,
  ConsultationPageInfo,
  ConsultationSettingsResponse,
  ConsultationSettingsUpdate,
  ConsultationStatus,
  SlotsResponse,
  WeeklyHour,
} from '../types/consultation';

// Map backend response to include alias fields for component backward compat
function mapConsultation(raw: Record<string, unknown>): Consultation {
  return {
    ...raw,
    // Aliases
    preferred_date: raw.date,
    preferred_time: raw.time,
    admin_notes: raw.notes,
  } as Consultation;
}

function mapConsultations(rawList: Record<string, unknown>[]): Consultation[] {
  return rawList.map(mapConsultation);
}

// ============================================
// Public API (no auth required)
// ============================================

export async function getConsultationPageInfo(slug: string): Promise<ConsultationPageInfo> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/consultation/${slug}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '페이지 정보를 불러올 수 없습니다.');
  }
  return response.json();
}

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

export async function submitConsultation(
  slug: string,
  data: ConsultationFormData
): Promise<{ message: string }> {
  // Map form data to backend field names
  const body = {
    student_name: data.studentName,
    student_phone: data.studentPhone,
    parent_name: data.parentName,
    parent_phone: data.parentPhone,
    date: data.preferredDate,
    time: data.preferredTime,
    notes: data.inquiryContent,
    source: 'online',
  };
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/public/consultation/${slug}/apply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '상담 신청에 실패했습니다.');
  }
  return response.json();
}

export async function checkSlugAvailability(
  slug: string
): Promise<{ available: boolean; message?: string }> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/public/check-slug/${slug}`
  );
  return response.json();
}

// ============================================
// Admin API (auth required)
// ============================================

// List consultations — backend returns flat array
export async function getConsultations(params?: {
  status?: string;
  date?: string; // single date filter (backend param)
}): Promise<Consultation[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.date) searchParams.append('date', params.date);

  const raw = await apiClient.get<Record<string, unknown>[]>(
    `/consultations?${searchParams.toString()}`
  );
  return mapConsultations(raw);
}

// Get single consultation
export async function getConsultation(id: number): Promise<Consultation> {
  const raw = await apiClient.get<Record<string, unknown>>(`/consultations/${id}`);
  return mapConsultation(raw);
}

// Update consultation — map frontend field names to backend
export async function updateConsultation(
  id: number,
  data: {
    status?: ConsultationStatus;
    adminNotes?: string;
    preferredDate?: string;
    preferredTime?: string;
    notes?: string;
    linked_student_id?: number;
    // Frontend extended fields — sent but backend ignores for now
    checklist?: unknown;
    consultationMemo?: string;
    studentName?: string;
    studentGrade?: string;
    studentSchool?: string;
    parentPhone?: string;
    gender?: 'male' | 'female' | '';
    mockTestGrades?: Record<string, number>;
    schoolGradeAvg?: number;
    admissionType?: string;
    targetSchool?: string;
    referrerStudent?: string;
  }
): Promise<Consultation> {
  // Map to backend ConsultationUpdate fields
  const body: Record<string, unknown> = {};
  if (data.status !== undefined) body.status = data.status;
  if (data.adminNotes !== undefined) body.notes = data.adminNotes;
  if (data.notes !== undefined) body.notes = data.notes;
  if (data.preferredDate !== undefined) body.date = data.preferredDate;
  if (data.preferredTime !== undefined) body.time = data.preferredTime;
  if (data.linked_student_id !== undefined) body.linked_student_id = data.linked_student_id;

  const raw = await apiClient.put<Record<string, unknown>>(`/consultations/${id}`, body);
  return mapConsultation(raw);
}

// Delete consultation (soft delete)
export async function deleteConsultation(id: number): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/consultations/${id}`);
}

// Link student — backend expects { student_id }
export async function linkStudent(
  consultationId: number,
  studentId: number
): Promise<Consultation> {
  const raw = await apiClient.post<Record<string, unknown>>(
    `/consultations/${consultationId}/link-student`,
    { student_id: studentId }
  );
  return mapConsultation(raw);
}

// ============================================
// Settings API — endpoint is /consultations/settings (NOT /settings/info)
// ============================================

export async function getConsultationSettings(): Promise<ConsultationSettingsResponse | null> {
  return apiClient.get<ConsultationSettingsResponse | null>('/consultations/settings');
}

export async function updateConsultationSettings(
  data: ConsultationSettingsUpdate
): Promise<ConsultationSettingsResponse> {
  return apiClient.put<ConsultationSettingsResponse>('/consultations/settings', data);
}

// Weekly hours — backend expects { weekly_hours: {"mon": ["09:00-12:00"], ...} }
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function convertWeeklyHoursToDict(hours: WeeklyHour[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const h of hours) {
    const dayName = DAY_NAMES[h.dayOfWeek];
    if (!dayName) continue;
    if (h.isAvailable && h.startTime && h.endTime) {
      if (!result[dayName]) result[dayName] = [];
      result[dayName].push(`${h.startTime}-${h.endTime}`);
    }
  }
  return result;
}

export async function updateWeeklyHours(
  weeklyHours: WeeklyHour[] | Record<string, string[]>
): Promise<{ weekly_hours: Record<string, string[]> }> {
  const dict = Array.isArray(weeklyHours)
    ? convertWeeklyHoursToDict(weeklyHours)
    : weeklyHours;
  return apiClient.put<{ weekly_hours: Record<string, string[]> }>(
    '/consultations/settings/weekly-hours',
    { weekly_hours: dict }
  );
}

// Blocked slots — backend expects { date, start_time, end_time, reason }
export async function addBlockedSlot(data: {
  blockedDate?: string;
  date?: string;
  isAllDay?: boolean;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  reason?: string;
}): Promise<{ id: number; date: string; start_time: string; end_time: string; reason?: string }> {
  const body = {
    date: data.date || data.blockedDate,
    start_time: data.start_time || data.startTime,
    end_time: data.end_time || data.endTime,
    reason: data.reason,
  };
  return apiClient.post('/consultations/settings/blocked-slots', body);
}

export async function removeBlockedSlot(id: number): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/consultations/settings/blocked-slots/${id}`);
}

// ============================================
// Calendar & Booked times
// ============================================

// Calendar events — backend uses year_month param, returns flat event array
export async function getCalendarEvents(
  yearMonth: string
): Promise<Record<string, unknown>[]> {
  return apiClient.get<Record<string, unknown>[]>(
    `/consultations/calendar/events?year_month=${yearMonth}`
  );
}

// Calendar grouped by date — backend returns { "YYYY-MM-DD": [...] }
export async function getCalendarGrouped(
  yearMonth: string
): Promise<Record<string, Consultation[]>> {
  const raw = await apiClient.get<Record<string, Record<string, unknown>[]>>(
    `/consultations/calendar?year_month=${yearMonth}`
  );
  const result: Record<string, Consultation[]> = {};
  for (const [date, list] of Object.entries(raw)) {
    result[date] = mapConsultations(list);
  }
  return result;
}

// Booked times — backend returns plain string array ["09:00", "10:00"]
export async function getBookedTimes(date: string): Promise<string[]> {
  return apiClient.get<string[]>(`/consultations/booked-times?date=${date}`);
}

// ============================================
// Direct consultation & Convert
// ============================================

// Admin direct consultation — map to backend ConsultationCreate fields
export async function createDirectConsultation(data: {
  studentName: string;
  phone?: string;
  grade?: string;
  gender?: 'male' | 'female' | '';
  studentSchool?: string;
  schoolGradeAvg?: number;
  admissionType?: string;
  mockTestGrades?: Record<string, number>;
  targetSchool?: string;
  referrerStudent?: string;
  preferredDate: string;
  preferredTime: string;
  notes?: string;
  adminNotes?: string;
}): Promise<Consultation> {
  const body = {
    student_name: data.studentName,
    student_phone: data.phone,
    date: data.preferredDate,
    time: data.preferredTime,
    notes: data.notes || data.adminNotes,
    source: 'walk_in',
  };
  const raw = await apiClient.post<Record<string, unknown>>('/consultations/direct', body);
  return mapConsultation(raw);
}

// Convert consultation to student — backend endpoint is /convert (not /convert-to-trial)
export async function convertToStudent(
  consultationId: number
): Promise<{ consultation: Consultation; student: Record<string, unknown> }> {
  const raw = await apiClient.post<{ consultation: Record<string, unknown>; student: Record<string, unknown> }>(
    `/consultations/${consultationId}/convert`,
    {}
  );
  return {
    consultation: mapConsultation(raw.consultation),
    student: raw.student,
  };
}

// Legacy aliases for backward compat
export const convertToTrialStudent = (
  consultationId: number,
  _trialDates?: unknown,
  _studentPhone?: string
) => convertToStudent(consultationId);

export const convertToPendingStudent = (
  consultationId: number,
  _studentPhone?: string,
  _memo?: string
) => convertToStudent(consultationId);

// Conduct consultation — mark as completed with notes
export async function conductConsultation(
  id: number,
  notes?: string
): Promise<Consultation> {
  const raw = await apiClient.post<Record<string, unknown>>(
    `/consultations/${id}/conduct`,
    { notes }
  );
  return mapConsultation(raw);
}

// Get consultation history/timeline
export async function getConsultationHistory(
  id: number
): Promise<{ consultation: Consultation; timeline: unknown[] }> {
  const raw = await apiClient.get<{ consultation: Record<string, unknown>; timeline: unknown[] }>(
    `/consultations/${id}/history`
  );
  return {
    consultation: mapConsultation(raw.consultation),
    timeline: raw.timeline,
  };
}

// Get consultation stats
export async function getConsultationStats(): Promise<{
  total: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  by_month: Record<string, number>;
}> {
  return apiClient.get('/consultations/stats');
}
