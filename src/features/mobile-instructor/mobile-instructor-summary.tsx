import type { MobileInstructorStats } from './mobile-instructor-types';

interface MobileInstructorSummaryProps {
  stats: MobileInstructorStats;
}

const summaryItems = [
  { key: 'present', label: '출근', className: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'late', label: '지각', className: 'text-amber-700 dark:text-amber-300' },
  { key: 'halfDay', label: '반차', className: 'text-sky-700 dark:text-sky-300' },
  { key: 'absent', label: '결근', className: 'text-rose-700 dark:text-rose-300' },
] as const;

export function MobileInstructorSummary({ stats }: MobileInstructorSummaryProps) {
  return (
    <section className="grid grid-cols-4 gap-2" aria-label="강사 출근 요약">
      {summaryItems.map((item) => (
        <div key={item.key} className="rounded-lg border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className={`font-mono text-xl font-semibold ${item.className}`}>{stats[item.key]}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
