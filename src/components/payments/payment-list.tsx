/**
 * Payment List Component
 * 학원비 목록 컴포넌트
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Coins, Check, Loader2, CreditCard, Banknote, Wallet, DollarSign } from 'lucide-react';
import type { Payment } from '@/lib/types/payment';
import {
  formatPaymentAmount,
  formatYearMonth,
  formatDate,
  getPaymentStatusColor,
  isOverdue,
} from '@/lib/utils/payment-helpers';
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/types/payment';

interface PaymentListProps {
  payments: Payment[];
  loading?: boolean;
  onPaymentClick: (id: number) => void;
  onCreditClick?: (payment: Payment) => void;
  showCreditButton?: boolean;
  onPaymentMark?: (payment: Payment, method: 'account' | 'card' | 'cash') => Promise<void>;
  showPaymentMarkButton?: boolean;
  markingPaymentId?: number | null;
  hideDueDate?: boolean;
  confirmBeforePayment?: boolean;
}

export function PaymentList({
  payments,
  loading,
  onPaymentClick,
  onCreditClick,
  showCreditButton = false,
  onPaymentMark,
  showPaymentMarkButton = false,
  markingPaymentId = null,
  hideDueDate = false,
  confirmBeforePayment = false,
}: PaymentListProps) {
  // 확인 다이얼로그 상태
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{
    payment: Payment;
    method: 'account' | 'card' | 'cash';
  } | null>(null);

  const methodLabels = {
    account: '계좌이체',
    card: '카드결제',
    cash: '현금결제',
  };

  const handlePaymentMarkClick = (payment: Payment, method: 'account' | 'card' | 'cash') => {
    if (confirmBeforePayment) {
      setPendingPayment({ payment, method });
      setConfirmDialogOpen(true);
    } else {
      onPaymentMark?.(payment, method);
    }
  };

  const handleConfirmPayment = () => {
    if (pendingPayment && onPaymentMark) {
      onPaymentMark(pendingPayment.payment, pendingPayment.method);
    }
    setConfirmDialogOpen(false);
    setPendingPayment(null);
  };

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
                {!hideDueDate && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    납부 기한
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  상태
                </th>
                {showCreditButton && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    크레딧
                  </th>
                )}
                {showPaymentMarkButton && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    납부처리
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
                      <div className="font-medium text-foreground">{payment.student_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-foreground">
                        {formatYearMonth(payment.year_month)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-semibold text-foreground">
                          {formatPaymentAmount(payment.final_amount)}
                        </div>
                        {payment.discount_amount > 0 && payment.base_amount !== payment.final_amount && (
                          <div className="text-xs text-muted-foreground">
                            기본: {formatPaymentAmount(payment.base_amount)}
                            {' | '}할인: -{formatPaymentAmount(payment.discount_amount)}
                          </div>
                        )}
                      </div>
                    </td>
                    {!hideDueDate && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-foreground'}>
                          {payment.due_date ? formatDate(payment.due_date) : '-'}
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
                    )}
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
                        <div className="flex items-center gap-2">
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
                        </div>
                      </td>
                    )}
                    {showPaymentMarkButton && onPaymentMark && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.payment_status === 'paid' ? (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <Check className="w-4 h-4 mr-1" />
                            완납
                          </span>
                        ) : markingPaymentId === payment.id ? (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-muted text-muted-foreground">
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            처리중...
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePaymentMarkClick(payment, 'account');
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900 shadow-sm hover:shadow transition-all active:scale-95"
                              title="계좌이체로 납부 처리"
                            >
                              <Wallet className="h-3.5 w-3.5 shrink-0" />
                              <span className="shrink-0">계좌</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePaymentMarkClick(payment, 'card');
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border-2 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900 shadow-sm hover:shadow transition-all active:scale-95"
                              title="카드결제로 납부 처리"
                            >
                              <CreditCard className="h-3.5 w-3.5 shrink-0" />
                              <span className="shrink-0">카드</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePaymentMarkClick(payment, 'cash');
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900 shadow-sm hover:shadow transition-all active:scale-95"
                              title="현금결제로 납부 처리"
                            >
                              <Banknote className="h-3.5 w-3.5 shrink-0" />
                              <span className="shrink-0">현금</span>
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* 납부 처리 확인 다이얼로그 */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>납부 처리 확인</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPayment && (
                <>
                  <span className="font-semibold">{pendingPayment.payment.student_name}</span>님의{' '}
                  <span className="font-semibold">{formatYearMonth(pendingPayment.payment.year_month)}</span> 학원비{' '}
                  <span className="font-semibold text-primary">{formatPaymentAmount(pendingPayment.payment.final_amount)}</span>을{' '}
                  <span className="font-semibold text-blue-600">{methodLabels[pendingPayment.method]}</span>로 납부 처리하시겠습니까?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPayment}>
              납부 처리
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
