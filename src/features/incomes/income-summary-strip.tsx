import { Banknote, CreditCard, Percent, TrendingUp } from 'lucide-react';
import { IncomeStatCard } from './income-stat-card';
import type { IncomeSummary } from './incomes-types';

interface IncomeSummaryStripProps {
  summary: IncomeSummary;
}

export function IncomeSummaryStrip({ summary }: IncomeSummaryStripProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="수입 요약">
      <IncomeStatCard label="총 수입" amount={summary.totalIncome} icon={TrendingUp} />
      <IncomeStatCard
        label="학원비 수납"
        amount={summary.totalTuition}
        detail={`${summary.tuitionCount}건`}
        icon={CreditCard}
      />
      <IncomeStatCard
        label="기타 수입"
        amount={summary.totalOther}
        detail={`${summary.otherCount}건`}
        icon={Banknote}
      />
      <section className="rounded-md border border-border bg-card p-5 shadow-none">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">수입 비율</p>
            <Percent className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-foreground/70" style={{ width: `${summary.tuitionRatio}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            학원비 {summary.tuitionRatio}% / 기타 {summary.otherRatio}%
          </p>
      </section>
    </section>
  );
}
