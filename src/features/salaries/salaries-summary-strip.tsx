import { AlertCircle, Banknote, CheckCircle, WalletCards } from 'lucide-react';
import type { SalarySummary } from './salaries-page-types';
import { formatWon } from './salaries-page-utils';
import { SalaryStatCard } from './salary-stat-card';

interface SalariesSummaryStripProps {
  summary: SalarySummary;
}

export function SalariesSummaryStrip({ summary }: SalariesSummaryStripProps) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="급여 요약">
      <SalaryStatCard label="총 급여 기록" value={`${summary.totalCount}건`} detail="선택 월 기준" icon={Banknote} tone="blue" />
      <SalaryStatCard label="지급 완료" value={`${summary.paidCount}건`} detail={formatWon(summary.totalPaid)} icon={CheckCircle} tone="green" />
      <SalaryStatCard label="미지급" value={`${summary.pendingCount}건`} detail={formatWon(summary.totalUnpaid)} icon={AlertCircle} tone="yellow" />
      <SalaryStatCard label="총 지급액" value={formatWon(summary.totalPaid)} detail="지급 완료 기준" icon={WalletCards} />
    </section>
  );
}
