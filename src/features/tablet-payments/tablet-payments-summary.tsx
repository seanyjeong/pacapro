import { AlertCircle, Banknote, CheckCircle2, Clock3 } from 'lucide-react';
import type { PaymentSummary } from '@/features/payments/payments-types';

interface TabletPaymentsSummaryProps {
  summary: PaymentSummary;
}

export function TabletPaymentsSummary({ summary }: TabletPaymentsSummaryProps) {
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="결제 요약">
      <SummaryItem icon={Banknote} label="청구" value={`${summary.currentMonthPayments.length}건`} />
      <SummaryItem icon={CheckCircle2} label="완납" value={`${summary.paidCount}건`} tone="success" />
      <SummaryItem icon={AlertCircle} label="미납" value={`${summary.unpaidCount}건`} tone="danger" />
      <SummaryItem
        icon={Clock3}
        label="전달 미납"
        value={`${summary.previousUnpaidPayments.length}건`}
        tone={summary.previousUnpaidPayments.length > 0 ? 'warning' : 'muted'}
      />
    </section>
  );
}

type SummaryTone = 'default' | 'success' | 'danger' | 'warning' | 'muted';

interface SummaryItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: SummaryTone;
}

function SummaryItem({ icon: Icon, label, value, tone = 'default' }: SummaryItemProps) {
  const toneClass = {
    default: 'text-slate-950 dark:text-slate-50',
    success: 'text-emerald-700 dark:text-emerald-300',
    danger: 'text-rose-700 dark:text-rose-300',
    warning: 'text-amber-700 dark:text-amber-300',
    muted: 'text-muted-foreground',
  }[tone];

  return (
    <div className="rounded-md border border-border bg-background px-4 py-3 shadow-none">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
