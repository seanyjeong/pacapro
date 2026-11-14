import { formatAmount } from './mobile-unpaid-utils';
import type { MobileUnpaidStats } from './mobile-unpaid-types';

interface MobileUnpaidSummaryProps {
  canViewAmount: boolean;
  stats: MobileUnpaidStats;
}

export function MobileUnpaidSummary({ canViewAmount, stats }: MobileUnpaidSummaryProps) {
  return (
    <section className="grid grid-cols-3 gap-2" aria-label="미납 요약">
      <div className="col-span-2 rounded-lg border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">미납 금액</p>
        <p className="mt-1 truncate font-mono text-2xl font-semibold text-foreground">
          {canViewAmount ? `${formatAmount(stats.totalUnpaid)}원` : '금액 숨김'}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3 text-center">
        <p className="font-mono text-2xl font-semibold text-foreground">{stats.count}</p>
        <p className="mt-1 text-xs text-muted-foreground">학생</p>
      </div>
    </section>
  );
}
