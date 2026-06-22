import type { ReportComputedStats, ReportStats } from './reports-types';
import { formatReportAmount } from './reports-utils';
import { ReportProgressRow } from './report-progress-row';

interface RevenueAnalysisPanelProps {
  stats: ReportStats;
  computed: ReportComputedStats;
}

export function RevenueAnalysisPanel({ stats, computed }: RevenueAnalysisPanelProps) {
  const billedAmount = stats.payments.totalAmount;
  const collectedPercent = billedAmount > 0 ? (stats.payments.paidAmountFromBilled / billedAmount) * 100 : 0;
  const unpaidPercent = billedAmount > 0 ? (computed.unpaidAmount / billedAmount) * 100 : 0;

  return (
    <section className="rounded-md border border-border bg-card p-5" aria-labelledby="revenue-analysis-title">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 id="revenue-analysis-title" className="text-lg font-semibold text-foreground">
            수입 분석
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">청구와 실제 수납을 분리해서 봅니다.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">수납률</p>
          <p className="text-2xl font-semibold text-primary">{computed.collectionRate}%</p>
        </div>
      </div>

      <div className="space-y-5">
        <ReportProgressRow
          label="청구 금액"
          percent={100}
          tone="primary"
          value={`${formatReportAmount(billedAmount)}원`}
        />
        <ReportProgressRow
          label="수납 완료"
          percent={collectedPercent}
          tone="success"
          value={`${formatReportAmount(stats.payments.paidAmountFromBilled)}원`}
        />
        <ReportProgressRow
          label="미수납 금액"
          percent={unpaidPercent}
          tone="danger"
          value={`${formatReportAmount(computed.unpaidAmount)}원`}
        />

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">실제 학원비 매출</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {formatReportAmount(stats.payments.paidAmount)}원
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">기타수입</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {formatReportAmount(stats.otherIncomes.totalAmount)}원
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stats.otherIncomes.total}건</p>
          </div>
        </div>
      </div>
    </section>
  );
}
