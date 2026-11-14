import { cn } from '@/lib/utils/cn';
import type { AttendanceStats } from './mobile-attendance-types';

const STAT_ITEMS = [
  { key: 'present', label: '출석', className: 'text-success' },
  { key: 'late', label: '지각', className: 'text-warning' },
  { key: 'absent', label: '결석', className: 'text-destructive' },
  { key: 'excused', label: '공결', className: 'text-primary' },
  { key: 'notMarked', label: '미체크', className: 'text-foreground' },
] as const;

export function MobileAttendanceStats({ stats }: { stats: AttendanceStats }) {
  return (
    <section className="grid grid-cols-5 rounded-2xl bg-card px-1 py-4" aria-label="출석 요약">
      {STAT_ITEMS.map((item) => (
        <div key={item.key} className="min-w-0 text-center">
          <p className={cn('text-[22px] font-extrabold leading-tight tabular-nums', item.className)}>{stats[item.key]}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
