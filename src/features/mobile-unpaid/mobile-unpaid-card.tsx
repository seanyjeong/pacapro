import { Calendar, Phone, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UnpaidPayment } from '@/lib/types/payment';
import { formatAmount, getContactPhone, getDisplayStudentName, getOverdueTone, getUnpaidAmount } from './mobile-unpaid-utils';

interface MobileUnpaidCardProps {
  canMarkPaid: boolean;
  canViewAmount: boolean;
  payment: UnpaidPayment;
  processing: boolean;
  onCall: (payment: UnpaidPayment) => void;
  onPay: (payment: UnpaidPayment) => void;
}

export function MobileUnpaidCard({
  canMarkPaid,
  canViewAmount,
  payment,
  processing,
  onCall,
  onPay,
}: MobileUnpaidCardProps) {
  const contactPhone = getContactPhone(payment);
  const studentName = getDisplayStudentName(payment);
  const daysOverdue = payment.days_overdue || 0;
  const overdueLabel = daysOverdue > 0 ? `${daysOverdue}일 연체` : '미납';

  return (
    <article
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      data-testid="mobile-unpaid-card"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h2 className="truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">{studentName}</h2>
            {canViewAmount && (
              <span className="shrink-0 font-mono text-sm font-semibold text-rose-700 dark:text-rose-300">
                {formatAmount(getUnpaidAmount(payment))}원
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Calendar className="h-3.5 w-3.5" />
            <span>{payment.year_month}</span>
            <span className={`rounded-full border px-2 py-0.5 font-medium ${getOverdueTone(daysOverdue)}`}>{overdueLabel}</span>
            {payment.payment_status === 'partial' && (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                부분납부
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {contactPhone ? (
          <a
            href={`tel:${contactPhone}`}
            aria-label={`${studentName} 보호자 전화`}
            onClick={() => onCall(payment)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-medium text-zinc-700 transition active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <Phone className="mr-1.5 h-4 w-4" />
            <span className="truncate">{contactPhone}</span>
          </a>
        ) : (
          <Button type="button" variant="outline" className="h-11" onClick={() => onCall(payment)}>
            <Phone className="mr-1.5 h-4 w-4" />
            전화
          </Button>
        )}
        <Button type="button" className="h-11" disabled={!canMarkPaid || processing} onClick={() => onPay(payment)}>
          완납 처리
        </Button>
      </div>
    </article>
  );
}
