/**
 * Payment List Component
 * 학원비 목록 컴포넌트
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins } from 'lucide-react';
import type { Payment } from '@/lib/types/payment';
import {
  formatPaymentAmount,
  formatYearMonth,
  formatDate,
  getPaymentStatusColor,
  getPaymentTypeColor,
  isOverdue,
} from '@/lib/utils/payment-helpers';
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/types/payment';

interface PaymentListProps {
  payments: Payment[];
  loading?: boolean;
  onPaymentClick: (id: number) => void;
  onCreditClick?: (payment: Payment) => void;
  showCreditButton?: boolean;
}

export function PaymentList({ payments, loading, onPaymentClick, onCreditClick, showCreditButton = false }: PaymentListProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">학원비 목록을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-muted-foreground mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">학원비 내역이 없습니다</h3>
          <p className="text-muted-foreground">
            학원비를 청구하시면 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  학생 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  청구 내역
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  납부 기한
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  상태
                </th>
                {showCreditButton && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    작업
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {payments.map((payment) => {
                const overdue = isOverdue(payment);
                return (
                  <tr
                    key={payment.id}
                    onClick={() => onPaymentClick(payment.id)}
                    className={`hover:bg-muted cursor-pointer transition-colors ${
                      overdue ? 'bg-red-50 dark:bg-red-950' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-foreground">{payment.student_name}</div>
                        <div className="text-sm text-muted-foreground">{payment.student_number}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${getPaymentTypeColor(
                              payment.payment_type
                            )}`}
                          >
                            {PAYMENT_TYPE_LABELS[payment.payment_type]}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatYearMonth(payment.year_month)}
                          </span>
                        </div>
                        {payment.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {payment.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-semibold text-foreground">
                          {formatPaymentAmount(payment.final_amount)}
                        </div>
                        {(payment.discount_amount > 0 || payment.additional_amount > 0) && (
                          <div className="text-xs text-muted-foreground">
                            {payment.base_amount !== payment.final_amount && (
                              <>
                                기본: {formatPaymentAmount(payment.base_amount)}
                                {payment.discount_amount > 0 && (
                                  <> | 할인: -{formatPaymentAmount(payment.discount_amount)}</>
                                )}
                                {payment.additional_amount > 0 && (
                                  <> | {payment.notes?.includes('비시즌 종강 일할') ? '비시즌 일할' : '추가'}: +{formatPaymentAmount(payment.additional_amount)}</>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-foreground'}>
                        {formatDate(payment.due_date)}
                      </div>
                      {payment.paid_date && (
                        <div className="text-sm text-green-600 dark:text-green-400">
                          납부: {formatDate(payment.paid_date)}
                        </div>
                      )}
                      {overdue && (
                        <div className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">연체</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(
                            payment.payment_status
                          )}`}
                        >
                          {PAYMENT_STATUS_LABELS[payment.payment_status]}
                        </span>
                        {payment.payment_method && payment.payment_status === 'paid' && (
                          <span className="text-xs text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[payment.payment_method]}
                          </span>
                        )}
                      </div>
                    </td>
                    {showCreditButton && onCreditClick && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreditClick(payment);
                          }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                        >
                          <Coins className="w-4 h-4 mr-1" />
                          크레딧
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
