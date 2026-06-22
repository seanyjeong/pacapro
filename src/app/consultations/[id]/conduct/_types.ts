// conduct/_types.ts — 상담 진행 페이지 로컬 타입 (ADR-018)

export interface LearningForm {
  admissionType: 'early' | 'regular';
  schoolGradeAvg: string;
  mockTestScores: Record<string, Record<string, string>>;
  academicMemo: string;
  physicalRecordType: 'latest' | 'average';
  physicalMemo: string;
  targetUniversity1: string;
  targetUniversity2: string;
  targetMemo: string;
  generalMemo: string;
}

export interface StudentEditForm {
  student_name: string;
  student_grade: string;
  gender: 'male' | 'female' | '';
  student_school: string;
  parent_phone: string;
  target_school: string;
}

export interface TrialDate {
  date: string;
  timeSlot: string;
}

export interface PreviousConsultation {
  id: number;
  consultation_id?: number;
  consultation_date: string;
  consultation_type: string;
  admission_type?: 'early' | 'regular' | null;
  school_grade_avg?: number | null;
  mock_test_scores?: LearningForm['mockTestScores'] | string | null;
  general_memo: string | null;
  academic_memo: string | null;
  physical_record_type?: 'latest' | 'average' | null;
  physical_memo: string | null;
  target_university_1?: string | null;
  target_university_2?: string | null;
  target_memo: string | null;
}

export interface PeakRecord {
  value: number;
  unit: string;
  direction: string;
  measured_at: string;
}

export interface MemoModalState {
  open: boolean;
  date: string;
  type: 'general' | 'academic' | 'physical' | 'target';
  content: string;
}

export interface LinkedStudent {
  id: number;
  name: string;
  grade: string;
  school?: string;
  student_type?: string;
}
