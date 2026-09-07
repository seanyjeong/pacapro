import { isAxiosError } from 'axios';
import { LEARNING_CONSULTATION_ERROR_MESSAGES as MESSAGES } from '@/constants/learning-consultation';

interface LearningConsultationErrorResponse {
  code?: unknown;
  error?: unknown;
}

export function getLearningConsultationErrorText(error: unknown): string {
  if (!isAxiosError<LearningConsultationErrorResponse>(error)) return MESSAGES.fallback;

  const response = error.response;
  if (response?.status === 400) {
    if (response.data?.code === 'STUDENT_GRADE_REQUIRED') return MESSAGES.missingGrade;
    if (response.data?.error === MESSAGES.requiredFields) return MESSAGES.requiredFields;
  }
  if (response?.status === 404) return MESSAGES.studentNotFound;

  // 알 수 없는 서버 응답이나 통신 오류의 내부 문구는 화면에 노출하지 않는다.
  return MESSAGES.fallback;
}
