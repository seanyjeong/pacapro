import { ChevronDown, ChevronUp, User } from 'lucide-react';
import type { PerformanceStudent, StudentAllScores } from './performance-types';
import { PerformanceScoreGrid } from './performance-score-grid';

interface PerformanceStudentRowProps {
  expanded: boolean;
  scores: StudentAllScores | null;
  scoresError: string | null;
  scoresLoading: boolean;
  student: PerformanceStudent;
  onToggle: () => void;
}

export function PerformanceStudentRow({
  expanded,
  scores,
  scoresError,
  scoresLoading,
  student,
  onToggle,
}: PerformanceStudentRowProps) {
  return (
    <div data-testid="performance-student-row">
      <button
        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left transition hover:bg-muted/40"
        type="button"
        onClick={onToggle}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <User className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{student.name}</span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {student.grade} · {student.school || '학교 미등록'}
            </span>
          </span>
        </span>
        {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/30 px-4 py-4">
          <PerformanceScoreGrid scores={scores} scoresError={scoresError} scoresLoading={scoresLoading} />
        </div>
      )}
    </div>
  );
}
