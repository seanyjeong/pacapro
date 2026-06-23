import apiClient from './client';

export interface JungsiStatus {
  success: boolean;
  academyId: number;
  branchName: string | null;
  isConfigured: boolean;
  linkedAt?: string | null;
  jungsiApi: {
    url: string;
    healthy: boolean;
    serviceTokenConfigured?: boolean;
    error?: string | null;
  };
  examTypes: string[];
  defaultExam: string;
  link: {
    required: boolean;
    mode: 'jungsi_login';
    linkedByUserId?: number | null;
  };
}

export interface JungsiLinkStartResponse {
  success: boolean;
  mode: 'jungsi_login';
  loginUrl: string;
  expiresAt: string;
  message: string;
}

export interface JungsiSubjectScore {
  선택과목?: string;
  원점수?: number;
  표준점수?: number;
  백분위?: number;
  등급?: string | number;
}

export interface JungsiScoreData {
  year: string;
  exam: string;
  국어?: JungsiSubjectScore;
  수학?: JungsiSubjectScore;
  영어?: { 원점수?: number; 등급?: string | number };
  한국사?: { 원점수?: number; 등급?: string | number };
  탐구1?: JungsiSubjectScore;
  탐구2?: JungsiSubjectScore;
}

export interface JungsiScoresResponse {
  success: boolean;
  matched: boolean;
  scores?: JungsiScoreData;
  message?: string;
  linkRequired?: boolean;
}

export const jungsiAPI = {
  getStatus: () => apiClient.get<JungsiStatus>('/jungsi/status'),
  startLink: () => apiClient.post<JungsiLinkStartResponse>('/jungsi/link/start'),
  getScores: (studentId: number, exam: string) => (
    apiClient.get<JungsiScoresResponse>(`/jungsi/scores/${studentId}?exam=${encodeURIComponent(exam)}`)
  ),
};
