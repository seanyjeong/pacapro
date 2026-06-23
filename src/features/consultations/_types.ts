// consultations/_types.ts
// Phase 4 #2 (ADR-018): 지역 타입 정의

export interface EditForm {
  studentName: string;
  studentGrade: string;
  studentSchool: string;
  parentPhone: string;
  gender: '' | 'male' | 'female';
  schoolGradeAvg: number | undefined;
  admissionType: '' | 'early' | 'regular' | 'both';
  mockTestGrades: {
    korean: number | undefined;
    math: number | undefined;
    english: number | undefined;
    exploration: number | undefined;
  };
  targetSchool: string;
  referrerStudent: string;
}

export interface DirectForm {
  studentName: string;
  phone: string;
  grade: string;
  gender: '' | 'male' | 'female';
  studentSchool: string;
  schoolGradeAvg: number | undefined;
  admissionType: '' | 'early' | 'regular' | 'both';
  mockTestGrades: {
    korean: number | undefined;
    math: number | undefined;
    english: number | undefined;
    exploration: number | undefined;
  };
  targetSchool: string;
  referrerStudent: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
}

export interface LearningForm {
  studentId: string;
  preferredDate: string;
  preferredTime: string;
  learningType: import('@/lib/types/consultation').LearningType;
  adminNotes: string;
}

export interface TrialDate {
  date: string;
  timeSlot: string;
}
