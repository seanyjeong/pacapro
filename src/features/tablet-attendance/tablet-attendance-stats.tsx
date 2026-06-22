import type { TabletAttendanceStats } from './tablet-attendance-types';

const STAT_ITEMS = [
  { key: 'total', label: '전체', className: 'text-zinc-700 dark:text-zinc-200' },
  { key: 'present', label: '출석', className: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'late', label: '지각', className: 'text-amber-700 dark:text-amber-300' },
  { key: 'absent', label: '결석', className: 'text-rose-700 dark:text-rose-300' },
  { key: 'excused', label: '공결', className: 'text-sky-700 dark:text-sky-300' },
  { key: 'notMarked', label: '미체크', className: 'text-zinc-600 dark:text-zinc-300' },
] as const;

export function TabletAttendanceStats({ stats }: { stats: TabletAttendanceStats }) {
  return (
    <section className="grid grid-cols-6 gap-2" aria-label="출석 요약">
      {STAT_ITEMS.map((item) => (
        <div key={item.key} className="rounded-lg border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className={`font-mono text-2xl font-semibold ${item.className}`}>{stats[item.key]}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
