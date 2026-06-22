import { CalendarDays, ClipboardList, Trophy } from 'lucide-react';
import type { StudentPerformance } from '@/lib/types/student';

interface StudentPerformanceProps {
  performances: StudentPerformance[];
  loading?: boolean;
}

const RECORD_TYPE_LABELS: Record<StudentPerformance['record_type'], string> = {
  competition: '대회',
  mock_exam: '모의고사',
  physical: '실기',
};

export function StudentPerformanceComponent({ performances, loading }: StudentPerformanceProps) {
  if (loading) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-5" aria-busy="true">
        <div className="h-4 w-24 rounded-md bg-muted" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-12 rounded-md bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (performances.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">성적 기록이 없습니다</h3>
            <p className="text-sm text-muted-foreground">
              성적관리에서 모의고사, 실기, 대회 기록을 등록하면 이 학생 프로필에 함께 표시됩니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground">
        <span>기록</span>
        <span>주요 지표</span>
      </div>
      <div className="divide-y divide-border">
        {performances.map((performance) => (
          <div key={performance.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5" />
                  {RECORD_TYPE_LABELS[performance.record_type]}
                </span>
                {performance.subject ? (
                  <span className="text-sm font-medium text-foreground">{performance.subject}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatRecordDate(performance.record_date)}
                {performance.notes ? <span className="truncate">· {performance.notes}</span> : null}
              </div>
            </div>
            <div className="text-sm font-semibold text-foreground">{formatPrimaryMetric(performance)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRecordDate(value: string) {
  return value.slice(0, 10).replaceAll('-', '.');
}

function formatPrimaryMetric(performance: StudentPerformance) {
  if (performance.score !== undefined && performance.max_score !== undefined) {
    return `${performance.score}/${performance.max_score}점`;
  }
  if (performance.score !== undefined) return `${performance.score}점`;
  if (performance.grade_rank !== undefined) return `학년 ${performance.grade_rank}등`;
  if (performance.school_rank !== undefined) return `교내 ${performance.school_rank}등`;
  return '기록 확인';
}
