import Link from 'next/link';
import { CreditCard, ReceiptText, UserRound } from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from './incomes-constants';
import type { TuitionPayment } from './incomes-types';
import { formatAmount } from './incomes-utils';

interface TuitionPaymentsTableProps {
  payments: TuitionPayment[];
}

export function TuitionPaymentsTable({ payments }: TuitionPaymentsTableProps) {
  return (
    <section aria-label="학원비 수납 내역">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4 sm:px-6">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[15px] font-bold text-foreground">학원비 수납 내역</h2>
      </div>

      <div className="divide-y divide-border/60 lg:hidden">
        {payments.map((payment) => (
          <article key={`tuition-${payment.id}`} className="px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-foreground">{payment.student_name}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {payment.year_month} · 납부 {payment.paid_date?.split('T')[0] || '-'} · {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method || '-'}
                </p>
              </div>
              <p className="shrink-0 text-base font-bold tabular-nums text-success">
                +{formatAmount(payment.final_amount)}원
              </p>
            </div>
            <TuitionPaymentActions payment={payment} mobile />
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto px-6 pb-2 lg:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-[13px] font-semibold text-muted-foreground">
              <th className="px-3 py-3 text-left">학생</th>
              <th className="px-3 py-3 text-left">청구월</th>
              <th className="px-3 py-3 text-right">금액</th>
              <th className="px-3 py-3 text-left">납부일</th>
              <th className="px-3 py-3 text-left">결제방법</th>
              <th className="px-3 py-3 text-right">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {payments.map((payment) => (
              <tr key={`tuition-${payment.id}`} className="transition-colors hover:bg-muted/50">
                <td className="px-3 py-3.5 text-[15px] font-semibold text-foreground">{payment.student_name}</td>
                <td className="px-3 py-3.5 text-muted-foreground">{payment.year_month}</td>
                <td className="px-3 py-3.5 text-right text-[15px] font-bold tabular-nums text-success">
                  +{formatAmount(payment.final_amount)}원
                </td>
                <td className="px-3 py-3.5 text-muted-foreground">{payment.paid_date?.split('T')[0] || '-'}</td>
                <td className="px-3 py-3.5 text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method || '-'}
                </td>
                <td className="px-3 py-3.5 text-right">
                  <TuitionPaymentActions payment={payment} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TuitionPaymentActions({ payment, mobile = false }: { payment: TuitionPayment; mobile?: boolean }) {
  const className = mobile
    ? 'mt-3 grid grid-cols-2 gap-2'
    : 'inline-flex items-center justify-end gap-2';

  return (
    <div className={className}>
      <Link
        aria-label={`${payment.student_name} 결제 상세 보기`}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
        href={`/payments/${payment.id}`}
      >
        <ReceiptText className="h-3.5 w-3.5" />
        결제
      </Link>
      <Link
        aria-label={`${payment.student_name} 학생 상세 보기`}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
        href={`/students/${payment.student_id}`}
      >
        <UserRound className="h-3.5 w-3.5" />
        학생
      </Link>
    </div>
  );
}
