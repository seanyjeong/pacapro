import apiClient from '@/lib/api/client';

export type LearningMockScores = Record<string, Record<string, string>>;

type JungsiSubjectScore = {
  등급?: string | number | null;
};

type JungsiScoreData = {
  국어?: JungsiSubjectScore;
  수학?: JungsiSubjectScore;
  영어?: JungsiSubjectScore;
  탐구1?: JungsiSubjectScore;
  탐구2?: JungsiSubjectScore;
};

type JungsiScoreResponse = {
  success: boolean;
  matched: boolean;
  scores?: JungsiScoreData | null;
};

const SCORE_EXAMS = [
  { exam: '3월', month: 'march' },
  { exam: '6월', month: 'june' },
  { exam: '9월', month: 'september' },
] as const;

const SUBJECT_MAP = [
  { source: '국어', target: 'korean' },
  { source: '수학', target: 'math' },
  { source: '영어', target: 'english' },
  { source: '탐구1', target: 'exploration1' },
  { source: '탐구2', target: 'exploration2' },
] as const;

export function createEmptyLearningMockScores(): LearningMockScores {
  return {
    march: { korean: '', math: '', english: '', exploration1: '', exploration2: '' },
    june: { korean: '', math: '', english: '', exploration1: '', exploration2: '' },
    september: { korean: '', math: '', english: '', exploration1: '', exploration2: '' },
  };
}

export function hasAnyLearningMockScore(scores: LearningMockScores | null | undefined) {
  if (!scores) return false;
  return Object.values(scores).some((subjects) => (
    Object.values(subjects || {}).some((value) => String(value ?? '').trim() !== '')
  ));
}

export function parseLearningMockScores(value: LearningMockScores | string | null | undefined) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value) as LearningMockScores;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeGrade(value: string | number | null | undefined) {
  const grade = String(value ?? '').trim();
  return grade === '-' ? '' : grade;
}

function mapJungsiScore(score: JungsiScoreData) {
  return SUBJECT_MAP.reduce<Record<string, string>>((acc, item) => {
    acc[item.target] = normalizeGrade(score[item.source]?.등급);
    return acc;
  }, {});
}

export function mergeMissingLearningMockScores(base: LearningMockScores, fallback: LearningMockScores) {
  const next = { ...base };
  for (const month of Object.keys(fallback)) {
    next[month] = { ...(next[month] || {}) };
    for (const [subject, value] of Object.entries(fallback[month] || {})) {
      if (!String(next[month][subject] ?? '').trim()) {
        next[month][subject] = value;
      }
    }
  }
  return next;
}

export async function fetchJungsiLearningMockScores(studentId: number) {
  const nextScores = createEmptyLearningMockScores();

  await Promise.all(SCORE_EXAMS.map(async ({ exam, month }) => {
    try {
      const response = await apiClient.get<JungsiScoreResponse>(
        `/jungsi/scores/${studentId}?exam=${encodeURIComponent(exam)}`,
        { suppressErrorToast: true },
      );
      if (response.success && response.matched && response.scores) {
        nextScores[month] = mapJungsiScore(response.scores);
      }
    } catch {
      // 정시엔진 보조 조회 실패는 상담 진행 자체를 막지 않는다.
    }
  }));

  return hasAnyLearningMockScore(nextScores) ? nextScores : null;
}
