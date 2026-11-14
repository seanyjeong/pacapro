import { Banknote, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { ReportAccess, ReportComputedStats, ReportStats } from './reports-types';
import { canSeeIncomeTotal, canSeeProfit, formatReportAmount } from './reports-utils';

interface ReportSummaryStripProps {
  access: ReportAccess;
  stats: ReportStats;
  computed: ReportComputedStats;
}

export function ReportSummaryStrip({ access, stats, computed }: ReportSummaryStripProps) {
  const items = [
    { label: '재원생', value: `${stats.students.active}명`, meta: `관리 대상 ${stats.students.total}명`, icon: Users },
  ];

  if (canSeeIncomeTotal(access)) {
    items.push({
      label: '총 수입',
      value: `${formatReportAmount(computed.totalIncome)}원`,
      meta: `학원비 ${formatReportAmount(stats.payments.paidAmount)}원`,
      icon: TrendingUp,
    });
  }

  if (access.expenses) {
    items.push({
      label: '총 지출',
      value: `${formatReportAmount(stats.expenses.totalAmount)}원`,
      meta: `${stats.expenses.total}건`,
      icon: TrendingDown,
    });
  }

  if (canSeeProfit(access)) {
    items.push({
      label: '순이익',
      value: `${formatReportAmount(computed.netProfit)}원`,
      meta: `마진율 ${computed.profitMargin}%`,
      icon: Banknote,
    });
  }

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4" aria-label="리포트 요약">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="truncate text-xl font-semibold text-foreground">{item.value}</p>
                <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
              </div>
              <Icon className="h-5 w-5 shrink-0 text-primary" />
            </div>
          </div>
        );
      })}
    </section>
  );
}
