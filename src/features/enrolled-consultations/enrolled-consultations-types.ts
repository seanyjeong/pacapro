import type { LearningType } from '@/lib/types/consultation';

export interface Student {
  id: number;
  name: string;
  grade: string;
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

export type DateFilter = 'all' | 'today' | 'week';

export interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateConsultationForm {
  studentId: string;
  preferredDate: string;
  preferredTime: string;
  learningType: LearningType;
  adminNotes: string;
  scores: Record<string, Record<string, string>>;
}
