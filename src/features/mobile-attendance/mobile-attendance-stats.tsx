import type { AttendanceStats } from './mobile-attendance-types';

const STAT_ITEMS = [
  { key: 'present', label: '출석', className: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'late', label: '지각', className: 'text-amber-700 dark:text-amber-300' },
  { key: 'absent', label: '결석', className: 'text-rose-700 dark:text-rose-300' },
  { key: 'excused', label: '공결', className: 'text-sky-700 dark:text-sky-300' },
  { key: 'notMarked', label: '미체크', className: 'text-zinc-600 dark:text-zinc-300' },
] as const;

export function MobileAttendanceStats({ stats }: { stats: AttendanceStats }) {
  return (
    <section className="grid grid-cols-5 gap-2" aria-label="출석 요약">
      {STAT_ITEMS.map((item) => (
        <div key={item.key} className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className={`font-mono text-lg font-semibold ${item.className}`}>{stats[item.key]}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
