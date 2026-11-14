import { cn } from '@/lib/utils/cn';
import type { MobileInstructorStats } from './mobile-instructor-types';

interface MobileInstructorSummaryProps {
  stats: MobileInstructorStats;
}

const summaryItems = [
  { key: 'present', label: '출근', className: 'text-success' },
  { key: 'late', label: '지각', className: 'text-warning' },
  { key: 'halfDay', label: '반차', className: 'text-primary' },
  { key: 'absent', label: '결근', className: 'text-destructive' },
] as const;

export function MobileInstructorSummary({ stats }: MobileInstructorSummaryProps) {
  return (
    <section className="grid grid-cols-4 rounded-2xl bg-card py-4" aria-label="강사 출근 요약">
      {summaryItems.map((item) => (
        <div key={item.key} className="text-center">
          <p className={cn('text-[22px] font-extrabold leading-tight tabular-nums', item.className)}>{stats[item.key]}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
