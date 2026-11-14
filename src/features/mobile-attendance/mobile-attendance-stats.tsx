import type { AttendanceStats } from './mobile-attendance-types';

const STAT_ITEMS = [
  { key: 'present', label: '출석', className: 'text-success' },
  { key: 'late', label: '지각', className: 'text-warning' },
  { key: 'absent', label: '결석', className: 'text-destructive' },
  { key: 'excused', label: '공결', className: 'text-sky-700 dark:text-sky-300' },
  { key: 'notMarked', label: '미체크', className: 'text-secondary-foreground' },
] as const;

export function MobileAttendanceStats({ stats }: { stats: AttendanceStats }) {
  return (
    <section className="grid grid-cols-5 gap-2" aria-label="출석 요약">
      {STAT_ITEMS.map((item) => (
        <div key={item.key} className="rounded-lg border border-border bg-card px-2 py-2 text-center">
          <p className={`font-mono text-lg font-semibold ${item.className}`}>{stats[item.key]}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
