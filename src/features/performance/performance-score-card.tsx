import type { ScoreData } from './performance-types';
import { getScoreSubjects } from './performance-utils';

interface PerformanceScoreCardProps {
  examTitle: string;
  scores: ScoreData | null;
}

export function PerformanceScoreCard({ examTitle, scores }: PerformanceScoreCardProps) {
  if (!scores) {
    return (
      <section className="rounded-md border border-border bg-background px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{examTitle}</h3>
          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">데이터 없음</span>
        </div>
        <p className="py-6 text-center text-sm text-muted-foreground">성적 정보가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-border bg-background px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{examTitle}</h3>
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          조회됨
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        {getScoreSubjects(scores).map((subject) => (
          <div key={subject.label} className="min-w-0 rounded-md bg-muted/40 px-2 py-2">
            <p className="text-xs text-muted-foreground">{subject.label}</p>
            <p className="mt-1 text-xl font-semibold tracking-normal text-foreground">{subject.grade}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{subject.subject}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
