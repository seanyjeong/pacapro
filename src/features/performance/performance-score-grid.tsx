import { AlertCircle, Loader2 } from 'lucide-react';
import type { StudentAllScores } from './performance-types';
import { PerformanceScoreCard } from './performance-score-card';
import { EXAM_TYPES, getExamTitle } from './performance-utils';

interface PerformanceScoreGridProps {
  scores: StudentAllScores | null;
  scoresError: string | null;
  scoresLoading: boolean;
}

export function PerformanceScoreGrid({ scores, scoresError, scoresLoading }: PerformanceScoreGridProps) {
  if (scoresLoading) {
    return (
      <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        성적 조회 중입니다.
      </div>
    );
  }

  if (scoresError) {
    return (
      <div className="flex min-h-32 items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-900">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {scoresError}
      </div>
    );
  }

  if (!scores) {
    return <p className="py-8 text-center text-sm text-muted-foreground">학생을 선택하면 성적을 조회합니다.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {EXAM_TYPES.map((exam) => (
        <PerformanceScoreCard key={exam} examTitle={getExamTitle(exam)} scores={scores[exam]} />
      ))}
    </div>
  );
}
