import type { TabletAttendanceStats } from './tablet-attendance-types';

const STAT_ITEMS = [
  { key: 'total', label: '전체', className: 'text-secondary-foreground' },
  { key: 'present', label: '출석', className: 'text-success' },
  { key: 'late', label: '지각', className: 'text-warning' },
  { key: 'absent', label: '결석', className: 'text-destructive' },
  { key: 'excused', label: '공결', className: 'text-sky-700 dark:text-sky-300' },
  { key: 'notMarked', label: '미체크', className: 'text-secondary-foreground' },
] as const;

export function TabletAttendanceStats({ stats }: { stats: TabletAttendanceStats }) {
  return (
    <section className="grid grid-cols-6 gap-2" aria-label="출석 요약">
      {STAT_ITEMS.map((item) => (
        <div key={item.key} className="rounded-lg border border-border bg-card p-3 text-center">
          <p className={`font-mono text-2xl font-semibold ${item.className}`}>{stats[item.key]}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
