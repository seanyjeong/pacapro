import { formatAmount } from './mobile-unpaid-utils';
import type { MobileUnpaidStats } from './mobile-unpaid-types';

interface MobileUnpaidSummaryProps {
  canViewAmount: boolean;
  stats: MobileUnpaidStats;
}

export function MobileUnpaidSummary({ canViewAmount, stats }: MobileUnpaidSummaryProps) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-card p-5" aria-label="미납 요약">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-secondary-foreground">미납 금액</p>
        <p className="mt-1 truncate text-[26px] font-extrabold leading-tight tracking-tight text-destructive tabular-nums">
          {canViewAmount ? `${formatAmount(stats.totalUnpaid)}원` : '금액 숨김'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-secondary-foreground">학생</p>
        <p className="mt-1 text-[26px] font-extrabold leading-tight tabular-nums text-foreground">{stats.count}명</p>
      </div>
    </section>
  );
}
