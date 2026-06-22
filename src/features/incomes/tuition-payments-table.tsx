import { CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PAYMENT_METHOD_LABELS } from './incomes-constants';
import type { TuitionPayment } from './incomes-types';
import { formatAmount } from './incomes-utils';

interface TuitionPaymentsTableProps {
  payments: TuitionPayment[];
}

export function TuitionPaymentsTable({ payments }: TuitionPaymentsTableProps) {
  return (
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-normal">
          <CreditCard className="h-4 w-4" />
          학원비 수납 내역
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
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
                <tr key={`tuition-${payment.id}`} className="hover:bg-muted/35">
                  <td className="px-5 py-3 font-medium text-foreground">{payment.student_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{payment.year_month}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-foreground">
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
      </CardContent>
    </Card>
  );
}
