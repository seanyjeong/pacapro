import { CreditCard } from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from './incomes-constants';
import type { TuitionPayment } from './incomes-types';
import { formatAmount } from './incomes-utils';

interface TuitionPaymentsTableProps {
  payments: TuitionPayment[];
}

export function TuitionPaymentsTable({ payments }: TuitionPaymentsTableProps) {
  return (
    <section className="rounded-md border border-border bg-card shadow-none" aria-label="학원비 수납 내역">
      <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">학원비 수납 내역</h2>
      </div>

      <div className="space-y-3 p-3 lg:hidden">
        {payments.map((payment) => (
          <article key={`tuition-${payment.id}`} className="rounded-md border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{payment.student_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{payment.year_month}</p>
              </div>
              <p className="shrink-0 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                +{formatAmount(payment.final_amount)}원
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">납부일</p>
                <p className="mt-1 text-foreground">{payment.paid_date?.split('T')[0] || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">결제방법</p>
                <p className="mt-1 text-foreground">
                  {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method || '-'}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">학생</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">청구월</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">금액</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">납부일</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">결제방법</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((payment) => (
              <tr key={`tuition-${payment.id}`} className="transition-colors hover:bg-muted/35">
                <td className="px-5 py-3 font-medium text-foreground">{payment.student_name}</td>
                <td className="px-5 py-3 text-muted-foreground">{payment.year_month}</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  +{formatAmount(payment.final_amount)}원
                </td>
                <td className="px-5 py-3 text-muted-foreground">{payment.paid_date?.split('T')[0] || '-'}</td>
                <td className="px-5 py-3 text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
