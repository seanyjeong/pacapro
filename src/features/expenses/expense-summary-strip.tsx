import { Banknote, CheckCircle, TrendingDown, WalletCards } from 'lucide-react';
import { ExpenseStatCard } from './expense-stat-card';
import type { ExpenseSummary } from './expenses-types';
import { formatAmount } from './expenses-utils';

interface ExpenseSummaryStripProps {
  summary: ExpenseSummary;
}

export function ExpenseSummaryStrip({ summary }: ExpenseSummaryStripProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="지출 요약">
      <ExpenseStatCard
        label="총 지출 건수"
        value={`${summary.totalCount}건`}
        icon={<TrendingDown className="h-4 w-4" />}
      />
      <ExpenseStatCard
        label="총 지출 금액"
        value={`-${formatAmount(summary.totalAmount)}원`}
        tone="danger"
        icon={<Banknote className="h-4 w-4" />}
      />
      <ExpenseStatCard
        label="월 평균 지출"
        value={`${formatAmount(summary.monthlyAverage)}원`}
        icon={<WalletCards className="h-4 w-4" />}
      />
      <ExpenseStatCard
        label="환불 대기"
        value={`${summary.refundPendingCount}건`}
        subValue={`급여 연동 ${summary.salaryLinkedCount}건`}
        tone={summary.refundPendingCount > 0 ? 'warning' : 'default'}
        icon={<CheckCircle className="h-4 w-4" />}
      />
    </section>
  );
}
