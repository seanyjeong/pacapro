import type { CreateConsultationForm, ScoreData } from './enrolled-consultations-types';

export const EXAM_TYPES = ['3월', '6월', '9월', '수능'] as const;
export const CREATE_SCORE_EXAMS = ['3월', '6월', '9월'] as const;
export const SCORE_SUBJECTS = ['국어', '수학', '영어', '탐구1', '탐구2'] as const;
export const ALL_STATUS_FILTER = 'all-statuses';
export const EMPTY_SCORE_VALUE = 'empty-score';

export function createInitialCreateForm(): CreateConsultationForm {
  return {
    studentId: '',
    preferredDate: '',
    preferredTime: '',
    learningType: 'regular',
    adminNotes: '',
    scores: {
      '3월': { 국어: '', 수학: '', 영어: '', 탐구1: '', 탐구2: '' },
      '6월': { 국어: '', 수학: '', 영어: '', 탐구1: '', 탐구2: '' },
      '9월': { 국어: '', 수학: '', 영어: '', 탐구1: '', 탐구2: '' },
    },
  };
}

export function createInitialCreateScores(): Record<string, ScoreData | null> {
  return {
    '3월': null,
    '6월': null,
    '9월': null,
  };
}
