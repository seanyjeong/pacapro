import type { MobileInstructorStats } from './mobile-instructor-types';

interface MobileInstructorSummaryProps {
  stats: MobileInstructorStats;
}

const summaryItems = [
  { key: 'present', label: '출근', className: 'text-success' },
  { key: 'late', label: '지각', className: 'text-warning' },
  { key: 'halfDay', label: '반차', className: 'text-sky-700 dark:text-sky-300' },
  { key: 'absent', label: '결근', className: 'text-destructive' },
] as const;

export function MobileInstructorSummary({ stats }: MobileInstructorSummaryProps) {
  return (
    <section className="grid grid-cols-4 gap-2" aria-label="강사 출근 요약">
      {summaryItems.map((item) => (
        <div key={item.key} className="rounded-lg border border-border bg-card p-3 text-center">
          <p className={`font-mono text-xl font-semibold ${item.className}`}>{stats[item.key]}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
