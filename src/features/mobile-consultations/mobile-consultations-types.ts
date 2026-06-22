import type { Consultation } from '@/lib/types/consultation';

export interface CreateConsultationForm {
  studentName: string;
  phone: string;
  grade: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
}

export interface CalendarMonth {
  year: number;
  month: number;
}

export interface ConsultationStats {
  total: number;
  active: number;
  finished: number;
  pending: number;
  confirmed: number;
}

export interface MobileConsultationsListProps {
  consultations: Consultation[];
  loading: boolean;
  error: string | null;
  stats: ConsultationStats;
  onOpen: (consultation: Consultation) => void;
  onRetry: () => void;
}
