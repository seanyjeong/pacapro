import type { ConsultationStatus } from '@/lib/types/consultation';
import type { LearningConsultationForm } from './consultation-calendar-types';

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
export const LEARNING_TIME_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const hour = index + 9;
  return `${hour.toString().padStart(2, '0')}:00`;
});

export const DEFAULT_LEARNING_FORM: LearningConsultationForm = {
  studentId: '',
  preferredTime: '10:00',
  learningType: 'regular',
  adminNotes: '',
};

export const STATUS_DOT_COLORS: Record<ConsultationStatus, string> = {
  pending: 'bg-yellow-400',
  confirmed: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-gray-400',
  no_show: 'bg-red-500',
};

export const LEARNING_STATUS_DOT_COLORS: Record<ConsultationStatus, string> = {
  pending: 'bg-emerald-300',
  confirmed: 'bg-emerald-500',
  completed: 'bg-emerald-700',
  cancelled: 'bg-gray-400',
  no_show: 'bg-red-500',
};

export function createDefaultLearningForm(): LearningConsultationForm {
  return { ...DEFAULT_LEARNING_FORM };
}
