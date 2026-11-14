import { Banknote, CheckCircle, TrendingDown, WalletCards } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { ExpenseSummary } from './expenses-types';
import { formatAmount } from './expenses-utils';

interface ExpenseSummaryStripProps {
  summary: ExpenseSummary;
}

export function ExpenseSummaryStrip({ summary }: ExpenseSummaryStripProps) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="지출 요약">
      <div className="min-w-0" data-testid="expenses-metric-total">
        <StatTile className="h-full" label="총 지출 건수" value={`${summary.totalCount}건`} icon={TrendingDown} />
      </div>
      <div className="min-w-0" data-testid="expenses-metric-amount">
        <StatTile
          className="h-full"
          label="총 지출 금액"
          value={<span className="text-destructive">-{formatAmount(summary.totalAmount)}원</span>}
          tone="danger"
          icon={Banknote}
        />
      </div>
      <StatTile
        className="h-full"
        label="월 평균 지출"
        value={`${formatAmount(summary.monthlyAverage)}원`}
        icon={WalletCards}
      />
      <div className="min-w-0" data-testid="expenses-metric-refund">
        <StatTile
          className="h-full"
          label="환불 대기"
          value={`${summary.refundPendingCount}건`}
          note={<span data-testid="expenses-metric-salary">급여 연동 {summary.salaryLinkedCount}건</span>}
          tone={summary.refundPendingCount > 0 ? 'warning' : 'neutral'}
          icon={CheckCircle}
        />
      </div>
    </section>
  );
}
