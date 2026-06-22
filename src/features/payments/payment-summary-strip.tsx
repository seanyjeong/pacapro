import { AlertCircle, Banknote, CheckCircle2, Percent } from 'lucide-react';
import type { PaymentSummary } from './payments-types';
import { PaymentStatCard } from './payment-stat-card';

interface PaymentSummaryStripProps {
  summary: PaymentSummary;
  viewOnly: boolean;
  isOwner: boolean;
}

export function PaymentSummaryStrip({ summary, viewOnly, isOwner }: PaymentSummaryStripProps) {
  if (viewOnly) {
    return (
      <section className="grid gap-3 md:grid-cols-2" aria-label="미납 요약">
        <PaymentStatCard label="미납 건수" value={`${summary.filteredCount}건`} tone="danger" icon={<AlertCircle className="h-4 w-4" />} />
        <PaymentStatCard
          label="미납 금액"
          value={`${summary.unpaidAmount.toLocaleString()}원`}
          tone="danger"
          icon={<Banknote className="h-4 w-4" />}
        />
      </section>
    );
  }

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="학원비 요약">
      <PaymentStatCard label="총 청구" value={`${summary.filteredCount}건`} tone="info" icon={<Banknote className="h-4 w-4" />} />
      <PaymentStatCard label="완납" value={`${summary.paidCount}건`} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
      <PaymentStatCard
        label="미납"
        value={`${summary.unpaidCount}건`}
        subValue={summary.previousUnpaidPayments.length > 0 ? `전달 미납 ${summary.previousUnpaidPayments.length}건` : undefined}
        tone="danger"
        icon={<AlertCircle className="h-4 w-4" />}
      />
      <PaymentStatCard
        label="납부율"
        value={`${summary.paidRate}%`}
        subValue={isOwner ? `${summary.paidAmount.toLocaleString()} / ${summary.totalAmount.toLocaleString()}원` : undefined}
        icon={<Percent className="h-4 w-4" />}
      />
    </section>
  );
}
