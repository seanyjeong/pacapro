// tablet/consultations/[id]/conduct/_types.ts — 태블릿 상담 진행 공유 타입 (ADR-018)

export interface TrialDate {
  date: string;
  timeSlot: string;
}

export interface StudentEditForm {
  student_name: string;
  student_grade: string;
  gender: 'male' | 'female' | '';
  student_school: string;
  parent_phone: string;
  target_school: string;
}

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

export interface LinkedStudent {
  id: number;
  name: string;
  grade: string;
  school?: string;
  student_type?: string;
}

export interface PeakRecord {
  value: number;
  unit: string;
  direction: string;
  measured_at: string;
}
