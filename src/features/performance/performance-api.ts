import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { ExamType, JungsiLinkStartResponse, JungsiStatus, PerformanceStudent, ScoreData } from './performance-types';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export async function fetchJungsiStatus(): Promise<JungsiStatus> {
  return apiClient.get<JungsiStatus>('/jungsi/status', QUIET_REQUEST);
}

export async function startJungsiLink(): Promise<JungsiLinkStartResponse> {
  return apiClient.post<JungsiLinkStartResponse>('/jungsi/link/start', undefined, QUIET_REQUEST);
}

export async function fetchPerformanceStudents(): Promise<PerformanceStudent[]> {
  const response = await apiClient.get<{ students: PerformanceStudent[] }>('/students?status=active,paused', QUIET_REQUEST);
  return response.students ?? [];
}

export async function fetchStudentExamScore(studentId: number, exam: ExamType): Promise<ScoreData | null> {
  const response = await apiClient.get<{ success: boolean; matched: boolean; scores: ScoreData | null }>(
    `/jungsi/scores/${studentId}?exam=${encodeURIComponent(exam)}`,
    QUIET_REQUEST
  );
  return response.success && response.matched ? response.scores : null;
}
