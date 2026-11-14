import { StudentParentNames } from '@/components/students/student-parent-names';
import type { Payment } from '@/lib/types/payment';
import { PAYMENT_TYPE_LABELS } from '@/lib/types/payment';
import { cn } from '@/lib/utils/cn';
import { formatYearMonth } from '@/lib/utils/payment-helpers';
import { getAmountLabel, getOutstandingAmount, getPaymentProgress, getSettledAmount, getStatusLabel, getStatusTone } from './payment-detail-utils';

export function PaymentDetailSummary({ payment }: { payment: Payment }) {
  const outstanding = getOutstandingAmount(payment);
  const settled = getSettledAmount(payment);
  const progress = getPaymentProgress(payment);
  const hasBalance = outstanding > 0;

  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[22px] font-extrabold tracking-tight text-foreground">{payment.student_name}</h2>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', getStatusTone(payment.payment_status))}>
            {getStatusLabel(payment)}
          </span>
          {settled > 0 && hasBalance ? (
            <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">부분납부 진행 중</span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {payment.student_number} · {formatYearMonth(payment.year_month)} {PAYMENT_TYPE_LABELS[payment.payment_type]}
        </p>
        <StudentParentNames student={payment} className="mt-1" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <AmountCell label="총 청구" value={getAmountLabel(payment.final_amount)} />
        <AmountCell label="이미 납부" value={getAmountLabel(settled)} tone={settled > 0 ? 'success' : 'muted'} />
        <AmountCell label="남은 금액" value={getAmountLabel(outstanding)} tone={hasBalance ? 'danger' : 'success'} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[13px] font-medium text-muted-foreground">
          <span>납부 진행률</span>
          <span className="tabular-nums">{progress}%</span>
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
    success: 'text-success',
    danger: 'text-destructive',
    muted: 'text-muted-foreground',
  }[tone];

  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl bg-muted px-4 py-3 sm:block">
      <p className="text-[13px] font-semibold text-secondary-foreground">{label}</p>
      <p className={cn('text-[20px] font-extrabold tabular-nums sm:mt-1 sm:text-[22px]', toneClass)}>{value}</p>
    </div>
  );
}
