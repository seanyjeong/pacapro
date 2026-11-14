import { SectionCard } from '@/components/ui/page';
import type { ReportAccess, ReportComputedStats, ReportStats } from './reports-types';
import { formatReportAmount } from './reports-utils';
import { ReportProgressRow } from './report-progress-row';

interface RevenueAnalysisPanelProps {
  access: ReportAccess;
  stats: ReportStats;
  computed: ReportComputedStats;
}

export function RevenueAnalysisPanel({ access, stats, computed }: RevenueAnalysisPanelProps) {
  const billedAmount = stats.payments.totalAmount;
  const collectedPercent = billedAmount > 0 ? (stats.payments.paidAmountFromBilled / billedAmount) * 100 : 0;
  const unpaidPercent = billedAmount > 0 ? (computed.unpaidAmount / billedAmount) * 100 : 0;

  return (
    <section aria-labelledby="revenue-analysis-title" className="min-w-0">
      <SectionCard
        className="h-full"
        title={<span id="revenue-analysis-title">수입 분석</span>}
        description="청구와 실제 수납을 나눠서 봐요."
        actions={(
          <div className="text-right" data-testid="reports-metric-collection">
            <p className="text-[13px] font-medium text-muted-foreground">수납률</p>
            <p className="text-[26px] font-extrabold leading-tight tabular-nums text-primary">{computed.collectionRate}%</p>
          </div>
        )}
      >
        <div className="space-y-5 pt-2">
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
            testId="reports-metric-unpaid"
            value={`${formatReportAmount(computed.unpaidAmount)}원`}
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-muted px-4 py-3">
              <p className="text-[13px] font-medium text-muted-foreground">실제 학원비 매출</p>
              <p className="mt-0.5 text-[17px] font-bold tabular-nums text-foreground">
                {formatReportAmount(stats.payments.paidAmount)}원
              </p>
            </div>
            {access.incomes && (
              <div className="rounded-xl bg-muted px-4 py-3">
                <p className="text-[13px] font-medium text-muted-foreground">기타수입</p>
                <p className="mt-0.5 text-[17px] font-bold tabular-nums text-foreground">
                  {formatReportAmount(stats.otherIncomes.totalAmount)}원
                </p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </section>
  );
}
