import type { Payment } from '@/lib/types/payment';
import { PAYMENT_TYPE_LABELS } from '@/lib/types/payment';
import { formatDate, formatYearMonth } from '@/lib/utils/payment-helpers';
import { getAmountLabel, getOutstandingAmount, getPaymentProgress, getSettledAmount, getStatusLabel, getStatusTone } from './payment-detail-utils';

export function PaymentDetailSummary({ payment }: { payment: Payment }) {
  const outstanding = getOutstandingAmount(payment);
  const settled = getSettledAmount(payment);
  const progress = getPaymentProgress(payment);
  const hasBalance = outstanding > 0;
  const focusLabel = hasBalance ? '남은 결제 금액' : '수납 완료 금액';
  const focusAmount = hasBalance ? outstanding : settled;
  const focusTone = hasBalance ? 'text-rose-700' : 'text-emerald-700';

  return (
    <section className="overflow-hidden rounded-md border border-border/70 bg-card">
      <div className="flex flex-col gap-4 border-b border-border/70 p-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">{payment.student_name}</h2>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(payment.payment_status)}`}>
              {getStatusLabel(payment)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{payment.student_number}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs text-muted-foreground">{focusLabel}</p>
          <p className={`text-2xl font-semibold ${focusTone}`}>{getAmountLabel(focusAmount)}</p>
          {settled > 0 && hasBalance ? (
            <p className="mt-1 text-xs text-muted-foreground">부분납부 후 남은 금액</p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-0 border-b border-border/70 sm:grid-cols-3">
        <AmountCell label="총 청구" value={getAmountLabel(payment.final_amount)} />
        <AmountCell label="이미 납부" value={getAmountLabel(settled)} tone={settled > 0 ? 'success' : 'muted'} />
        <AmountCell label="남은 금액" value={getAmountLabel(outstanding)} tone={hasBalance ? 'danger' : 'success'} />
      </div>
      <div className="grid gap-0 border-b border-border/70 sm:grid-cols-3">
        <SummaryCell label="청구 유형" value={PAYMENT_TYPE_LABELS[payment.payment_type]} />
        <SummaryCell label="청구 월" value={formatYearMonth(payment.year_month)} />
        <SummaryCell label="납부 기한" value={formatDate(payment.due_date)} />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>납부 진행률</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}

function AmountCell({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'danger' | 'muted' }) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-emerald-700',
    danger: 'text-rose-700',
    muted: 'text-muted-foreground',
  }[tone];

  return (
    <div className="border-b border-border/70 bg-muted/20 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/70 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
