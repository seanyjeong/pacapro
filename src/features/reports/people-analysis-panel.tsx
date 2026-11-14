import { SectionCard } from '@/components/ui/page';
import type { ReportAccess, ReportStats } from './reports-types';
import { formatReportAmount } from './reports-utils';

interface PeopleAnalysisPanelProps {
  access: ReportAccess;
  stats: ReportStats;
}

export function PeopleAnalysisPanel({ access, stats }: PeopleAnalysisPanelProps) {
  // 재원생 수는 위 요약 칸에 있으므로 여기서는 되풀이하지 않는다.
  const rows = [
    { label: '휴원생', value: `${stats.students.paused}명`, marker: 'bg-warning' },
  ];
  if (access.instructors) {
    rows.push({ label: '활동 강사', value: `${stats.instructors.active}명`, marker: 'bg-primary' });
  }

  return (
    <section aria-labelledby="people-analysis-title" className="min-w-0" data-testid="reports-metric-people">
      <SectionCard title={<span id="people-analysis-title">학생 현황</span>}>
        <div className="divide-y divide-border/60">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${row.marker}`} />
                <span className="text-[15px] text-foreground">{row.label}</span>
              </div>
              <span className="text-[17px] font-bold tabular-nums text-foreground">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-xl bg-muted px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[15px] font-semibold text-foreground">평균 월 수강료</span>
            <span className="text-[19px] font-extrabold tabular-nums text-primary">
              {formatReportAmount(stats.students.avgMonthlyTuition)}원
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">재원생 기준, 0원 제외</p>
        </div>
      </SectionCard>
    </section>
  );
}
