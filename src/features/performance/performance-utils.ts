import type {
  ExamType,
  JungsiStatus,
  PerformanceStudent,
  PerformanceStudentStatusFilter,
  ScoreData,
  StudentAllScores,
  SubjectScore,
} from './performance-types';

export const EXAM_TYPES: ExamType[] = ['3월', '6월', '9월', '수능'];
export const STATUS_LOAD_ERROR = '정시엔진 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const STUDENTS_LOAD_ERROR = '학생 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const SCORES_LOAD_ERROR = '성적 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function createEmptyScores(): StudentAllScores {
  return { '3월': null, '6월': null, '9월': null, 수능: null };
}

export function filterStudents(
  students: PerformanceStudent[],
  query: string,
  statusFilter: PerformanceStudentStatusFilter
): PerformanceStudent[] {
  const term = query.trim().toLowerCase();
  return students.filter((student) => {
    if (statusFilter !== 'all' && student.status !== statusFilter) return false;
    if (!term) return true;
    return (
      student.name.toLowerCase().includes(term) ||
      (student.school ?? '').toLowerCase().includes(term) ||
      student.grade.includes(query.trim())
    );
  });
}

export function getExamTitle(exam: ExamType): string {
  return exam === '수능' ? '수능' : `${exam} 모평`;
}

export function isJungsiLinked(status: JungsiStatus | null): boolean {
  const branchName = status?.branchName?.trim();
  return Boolean(status && (status.isConfigured || status.link?.required === false || branchName));
}

export function isJungsiReady(status: JungsiStatus | null, statusError: string | null): boolean {
  return Boolean(isJungsiLinked(status) && status?.jungsiApi.healthy && !statusError);
}

export function getJungsiStatusLabel(
  status: JungsiStatus | null,
  statusError: string | null,
  statusLoading: boolean
): string {
  if (statusLoading) return '연결 확인 중';
  if (isJungsiReady(status, statusError)) return '연결됨';
  if (isJungsiLinked(status)) return '연결 확인 필요';
  return statusError ? '연결 확인 필요' : '연동 필요';
}

export function getBranchLabel(branchName: string | null, linked = false): string {
  const trimmedBranchName = branchName?.trim();
  if (trimmedBranchName) return `${trimmedBranchName} 지점`;
  return linked ? '지점 정보 확인 중' : '지점 미연동';
}

export function getGrade(score?: SubjectScore | { 등급?: string } | null): string {
  return score?.등급 ?? '-';
}

export function getSubjectName(score?: SubjectScore | null): string {
  return score?.선택과목 ?? '';
}

export function hasAnyScores(scores: StudentAllScores | null): boolean {
  return Boolean(scores && EXAM_TYPES.some((exam) => scores[exam]));
}

export function getScoreSubjects(scores: ScoreData) {
  return [
    { label: '국어', grade: getGrade(scores.국어), subject: getSubjectName(scores.국어) },
    { label: '수학', grade: getGrade(scores.수학), subject: getSubjectName(scores.수학) },
    { label: '영어', grade: getGrade(scores.영어), subject: '' },
    { label: '탐구1', grade: getGrade(scores.탐구1), subject: getSubjectName(scores.탐구1) },
    { label: '탐구2', grade: getGrade(scores.탐구2), subject: getSubjectName(scores.탐구2) },
    { label: '한국사', grade: getGrade(scores.한국사), subject: '' },
  ];
}
