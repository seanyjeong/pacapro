import type { ReportStats } from './reports-types';
import { formatReportAmount } from './reports-utils';

interface PeopleAnalysisPanelProps {
  stats: ReportStats;
}

export function PeopleAnalysisPanel({ stats }: PeopleAnalysisPanelProps) {
  const rows = [
    { label: '재원생', value: `${stats.students.active}명`, marker: 'bg-emerald-500' },
    { label: '휴원생', value: `${stats.students.paused}명`, marker: 'bg-amber-400' },
    { label: '활동 강사', value: `${stats.instructors.active}명`, marker: 'bg-sky-500' },
  ];

  return (
    <section className="rounded-md border border-border bg-card p-5" aria-labelledby="people-analysis-title">
      <div className="mb-5">
        <h2 id="people-analysis-title" className="text-lg font-semibold text-foreground">
          학생 현황
        </h2>
      </div>

      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${row.marker}`} />
              <span className="text-sm text-foreground">{row.label}</span>
            </div>
            <span className="text-base font-semibold text-foreground">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">평균 월 수강료</span>
          <span className="text-lg font-semibold text-primary">
            {formatReportAmount(stats.students.avgMonthlyTuition)}원
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">재원생 기준, 0원 제외</p>
      </div>
    </section>
  );
}
