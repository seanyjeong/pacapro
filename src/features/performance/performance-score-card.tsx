import { Badge } from '@/components/ui/badge';
import type { ScoreData } from './performance-types';
import { getScoreSubjects } from './performance-utils';

interface PerformanceScoreCardProps {
  examTitle: string;
  scores: ScoreData | null;
}

export function PerformanceScoreCard({ examTitle, scores }: PerformanceScoreCardProps) {
  if (!scores) {
    return (
      <section className="rounded-xl bg-card px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-bold text-foreground">{examTitle}</h3>
          <Badge variant="secondary">데이터 없음</Badge>
        </div>
        <p className="py-6 text-center text-sm text-muted-foreground">성적 정보가 없어요.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-card px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold text-foreground">{examTitle}</h3>
        <Badge variant="success">조회됨</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-3 xl:grid-cols-6">
        {getScoreSubjects(scores).map((subject) => (
          <div key={subject.label} className="min-w-0 rounded-xl bg-muted px-2 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">{subject.label}</p>
            <p className="mt-0.5 text-xl font-extrabold text-foreground tabular-nums">{subject.grade}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{subject.subject}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
