import { AlertCircle, Banknote, CheckCircle2, Clock3 } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { PaymentSummary } from '@/features/payments/payments-types';

interface TabletPaymentsSummaryProps {
  summary: PaymentSummary;
}

export function TabletPaymentsSummary({ summary }: TabletPaymentsSummaryProps) {
  const previousCount = summary.previousUnpaidPayments.length;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="결제 요약">
      <StatTile icon={Banknote} label="청구" value={`${summary.currentMonthPayments.length}건`} tone="primary" />
      <StatTile icon={CheckCircle2} label="완납" value={`${summary.paidCount}건`} tone="success" />
      <StatTile
        icon={AlertCircle}
        label="미납"
        value={`${summary.unpaidCount}건`}
        note={summary.unpaidPartialCount > 0 ? `부분납부 ${summary.unpaidPartialCount}건 포함` : undefined}
        tone="danger"
      />
      <StatTile icon={Clock3} label="전달 미납" value={`${previousCount}건`} tone={previousCount > 0 ? 'warning' : 'neutral'} />
    </section>
  );
}
