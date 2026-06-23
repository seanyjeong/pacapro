export interface PerformanceStudent {
  id: number;
  name: string;
  school: string | null;
  grade: string;
  status: string;
}

export interface JungsiStatus {
  success: boolean;
  academyId: number;
  branchName: string | null;
  isConfigured: boolean;
  jungsiApi: {
    url: string;
    healthy: boolean;
  };
  examTypes: string[];
  defaultExam: string;
}

export interface SubjectScore {
  선택과목?: string;
  원점수?: number;
  표준점수?: number;
  백분위?: number;
  등급?: string;
}

export interface ScoreData {
  year: string;
  exam: string;
  국어?: SubjectScore;
  수학?: SubjectScore;
  영어?: { 원점수?: number; 등급?: string };
  한국사?: { 원점수?: number; 등급?: string };
  탐구1?: SubjectScore;
  탐구2?: SubjectScore;
}

export type ExamType = '3월' | '6월' | '9월' | '수능';
export type PerformanceTab = '내신' | '모의고사';
export type PerformanceStudentStatusFilter = 'all' | 'active' | 'paused';
export type StudentAllScores = Record<ExamType, ScoreData | null>;
