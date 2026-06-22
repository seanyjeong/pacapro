import type { ReportComputedStats, ReportStats } from './reports-types';
import { formatReportAmount } from './reports-utils';

interface ProfitAnalysisPanelProps {
  stats: ReportStats;
  computed: ReportComputedStats;
}

export function ProfitAnalysisPanel({ stats, computed }: ProfitAnalysisPanelProps) {
  const profitTone = computed.netProfit >= 0 ? 'text-sky-700' : 'text-rose-700';

  return (
    <section className="rounded-md border border-border bg-card p-5" aria-labelledby="profit-analysis-title">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="profit-analysis-title" className="text-lg font-semibold text-foreground">
          손익 분석
        </h2>
        <p className="text-sm text-muted-foreground">수납 기준 매출에서 지출을 차감합니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="font-medium text-foreground">총 수입</span>
            <span className="text-lg font-semibold text-emerald-700">
              +{formatReportAmount(computed.totalIncome)}원
            </span>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-4">
              <span>학원비 수납</span>
              <span>+{formatReportAmount(stats.payments.paidAmount)}원</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>기타수입</span>
              <span>+{formatReportAmount(stats.otherIncomes.totalAmount)}원</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border border-rose-200 bg-rose-50/70 p-4">
          <span className="font-medium text-foreground">총 지출</span>
          <span className="text-lg font-semibold text-rose-700">
            -{formatReportAmount(stats.expenses.totalAmount)}원
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/40 p-4">
          <span className="font-medium text-foreground">순이익</span>
          <span className={`text-xl font-semibold ${profitTone}`}>
            {computed.netProfit >= 0 ? '+' : ''}
            {formatReportAmount(computed.netProfit)}원
          </span>
        </div>
      </div>
    </section>
  );
}
