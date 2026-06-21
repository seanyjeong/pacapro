import type { LearningType } from '@/lib/types/consultation';

export interface StudentConsultationMemo {
  id: number;
  student_id: number;
  consultation_date: string;
  consultation_type: string;
  general_memo: string | null;
  academic_memo: string | null;
  physical_memo: string | null;
  target_memo: string | null;
  student_name: string;
  grade: string;
}

export interface CalendarStudent {
  id: number;
  name: string;
  grade: string;
}

export interface LearningConsultationForm {
  studentId: string;
  preferredTime: string;
  learningType: LearningType;
  adminNotes: string;
}
