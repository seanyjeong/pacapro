import { Calculator, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentPayment } from '@/lib/types/student';
import { PAYMENT_STATUS_LABELS } from '@/lib/types/student';
import { PAYMENT_METHOD_LABELS } from '@/lib/types/payment';
import { formatDate, formatCurrency, getPaymentStatusColor } from '@/lib/utils/student-helpers';

interface StudentPaymentHistoryProps {
  payments: StudentPayment[];
  recalculating: boolean;
  studentId?: number;
  onRecalculateClick: () => void;
}

export function StudentPaymentHistory({
  payments,
  recalculating,
  studentId,
  onRecalculateClick,
}: StudentPaymentHistoryProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          납부 내역
          {payments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({payments.length}건)
            </span>
          )}
        </CardTitle>
        {studentId ? (
          <Button
            size="sm"
            variant="outline"
            disabled={recalculating}
            onClick={onRecalculateClick}
          >
            <Calculator className="w-4 h-4 mr-1" />
            {recalculating ? '재계산 중...' : '첫 달 일할 재계산'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {payments.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">납부 내역이 없습니다</h3>
            <p className="text-muted-foreground">아직 등록된 납부 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    납부 기간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    납부 금액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    납부 방법
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    납부일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {payments.map((payment) => {
                  const finalAmount = parseFloat(payment.final_amount) || 0;
                  const paidAmount = parseFloat(payment.paid_amount) || 0;
                  const remaining = finalAmount - paidAmount;

                  return (
                    <tr key={payment.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">{payment.year_month}</div>
                        <div className="text-xs text-muted-foreground">납부기한: {formatDate(payment.due_date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-foreground">{formatCurrency(payment.final_amount)}</div>
                        {parseFloat(payment.discount_amount) > 0 && (
                          <div className="text-xs text-muted-foreground">할인: {formatCurrency(payment.discount_amount)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-foreground">{formatCurrency(payment.paid_amount)}</div>
                        {remaining > 0 && (
                          <div className="text-xs text-red-500 dark:text-red-400">
                            미납: {formatCurrency(remaining)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-foreground">
                          {payment.payment_method ? PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-foreground">
                          {payment.paid_date ? formatDate(payment.paid_date) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPaymentStatusColor(payment.payment_status)}`}>
                          {PAYMENT_STATUS_LABELS[payment.payment_status] || payment.payment_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
