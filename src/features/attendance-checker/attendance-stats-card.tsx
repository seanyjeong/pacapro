import type { calculateAttendanceStats } from '@/lib/utils/schedule-helpers';
import { cn } from '@/lib/utils';

type AttendanceStats = ReturnType<typeof calculateAttendanceStats>;

interface AttendanceStatsCardProps {
  stats: AttendanceStats;
}

export function AttendanceStatsCard({ stats }: AttendanceStatsCardProps) {
  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6" aria-label="출석 통계">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-secondary-foreground">출석률</p>
          <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight text-foreground tabular-nums">
            {stats.presentRate}%
          </p>
        </div>
        <p className="text-[13px] text-muted-foreground">
          전체 <b className="font-bold text-foreground tabular-nums">{stats.total}</b>명
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${stats.presentRate}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
        <StatCell label="출석" value={stats.present} className="text-success" />
        <StatCell label="지각" value={stats.late} className="text-warning" />
        <StatCell label="결석" value={stats.absent} className="text-destructive" />
        <StatCell label="공결" value={stats.excused} className="text-primary" />
        <StatCell label="보충" value={stats.makeup} className="text-foreground" />
      </div>
    </section>
  );
}

interface StatCellProps {
  label: string;
  value: number;
  className?: string;
}

function StatCell({ label, value, className }: StatCellProps) {
  return (
    <div className="rounded-xl bg-muted px-1 py-2.5 text-center">
      <p className={cn('text-xl font-extrabold leading-tight tabular-nums', className)}>{value}</p>
      <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
