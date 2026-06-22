import { formatAmount } from './mobile-unpaid-utils';
import type { MobileUnpaidStats } from './mobile-unpaid-types';

interface MobileUnpaidSummaryProps {
  canViewAmount: boolean;
  stats: MobileUnpaidStats;
}

export function MobileUnpaidSummary({ canViewAmount, stats }: MobileUnpaidSummaryProps) {
  return (
    <section className="grid grid-cols-3 gap-2" aria-label="미납 요약">
      <div className="col-span-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">미납 금액</p>
        <p className="mt-1 truncate font-mono text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          {canViewAmount ? `${formatAmount(stats.totalUnpaid)}원` : '금액 숨김'}
        </p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-mono text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{stats.count}</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">학생</p>
      </div>
    </section>
  );
}
