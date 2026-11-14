import { Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
    <article className="rounded-2xl bg-card p-4" data-testid="mobile-unpaid-card">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-[15px] font-bold text-secondary-foreground">
          {studentName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h2 className="truncate text-[17px] font-bold text-foreground">{studentName}</h2>
            {canViewAmount && (
              <span className="shrink-0 text-[17px] font-extrabold text-destructive tabular-nums">
                {formatAmount(getUnpaidAmount(payment))}원
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            <span className="tabular-nums">{payment.year_month}</span>
            <Badge variant={getOverdueTone(daysOverdue)}>{overdueLabel}</Badge>
            {payment.payment_status === 'partial' && <Badge variant="default">부분납부</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {contactPhone ? (
          <a
            href={`tel:${contactPhone}`}
            aria-label={`${studentName} 보호자 전화`}
            onClick={() => onCall(payment)}
            className={buttonVariants({ variant: 'outline', className: 'min-w-0 px-2' })}
          >
            <Phone className="h-4 w-4" />
            <span className="truncate text-sm tabular-nums">{contactPhone}</span>
          </a>
        ) : (
          <Button type="button" variant="outline" onClick={() => onCall(payment)}>
            <Phone className="h-4 w-4" />
            전화
          </Button>
        )}
        <Button type="button" disabled={!canMarkPaid || processing} onClick={() => onPay(payment)}>
          완납 처리
        </Button>
      </div>
    </article>
  );
}
