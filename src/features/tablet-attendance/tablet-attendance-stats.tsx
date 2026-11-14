import { cn } from '@/lib/utils/cn';
import type { TabletAttendanceStats } from './tablet-attendance-types';

const STAT_ITEMS = [
  { key: 'total', label: '전체', className: 'text-foreground' },
  { key: 'present', label: '출석', className: 'text-success' },
  { key: 'late', label: '지각', className: 'text-warning' },
  { key: 'absent', label: '결석', className: 'text-destructive' },
  { key: 'excused', label: '공결', className: 'text-primary' },
  { key: 'notMarked', label: '미체크', className: 'text-secondary-foreground' },
] as const;

export function TabletAttendanceStats({ stats }: { stats: TabletAttendanceStats }) {
  return (
    <section className="grid grid-cols-6 divide-x divide-border/60 rounded-2xl bg-card py-4" aria-label="출석 요약">
      {STAT_ITEMS.map((item) => (
        <div key={item.key} className="text-center">
          <p className={cn('text-[26px] font-extrabold leading-tight tabular-nums', item.className)}>{stats[item.key]}</p>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
