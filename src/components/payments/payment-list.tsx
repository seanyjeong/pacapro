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
import { Coins, Check, Loader2, CreditCard, Banknote, Wallet } from 'lucide-react';
import type { Payment } from '@/lib/types/payment';
import { cn } from '@/lib/utils/cn';
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

type MarkMethod = 'account' | 'card' | 'cash';

const PAYMENT_ACTIONS = [
  { method: 'account', label: '계좌', Icon: Wallet, className: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300' },
  { method: 'card', label: '카드', Icon: CreditCard, className: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300' },
  { method: 'cash', label: '현금', Icon: Banknote, className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' },
] as const;

interface PaymentListProps {
  payments: Payment[];
  loading?: boolean;
  onPaymentClick: (id: number) => void;
  onCreditClick?: (payment: Payment) => void;
  showCreditButton?: boolean;
  onPaymentMark?: (payment: Payment, method: MarkMethod) => Promise<void>;
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
    method: MarkMethod;
  } | null>(null);

  const methodLabels = {
    account: '계좌이체',
    card: '카드결제',
    cash: '현금결제',
  };

  const handlePaymentMarkClick = (payment: Payment, method: MarkMethod) => {
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

  const renderCreditAction = (payment: Payment) => {
    if (!showCreditButton || !onCreditClick) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onCreditClick(payment);
          }}
          className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        >
          <Coins className="mr-1 h-4 w-4" />
          크레딧
        </Button>
        {payment.credit_balance && payment.credit_balance > 0 ? (
          <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {Math.floor(payment.credit_balance).toLocaleString()}원
          </span>
        ) : null}
      </div>
    );
  };

  const renderPaymentActions = (payment: Payment) => {
    if (!showPaymentMarkButton || !onPaymentMark) return null;
    if (payment.payment_status === 'paid') {
      return (
        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check className="mr-1 h-4 w-4" />
          완납
        </span>
      );
    }

    if (markingPaymentId === payment.id) {
      return (
        <span className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          처리중...
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {PAYMENT_ACTIONS.map(({ method, label, Icon, className }) => (
          <Button
            key={method}
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              handlePaymentMarkClick(payment, method);
            }}
            className={cn('gap-1 border px-2 text-xs font-semibold shadow-none active:scale-95', className)}
            title={`${methodLabels[method]}로 납부 처리`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">{label}</span>
          </Button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="rounded-md border-border shadow-none">
        <CardContent className="space-y-3 p-5">
          <div className="h-10 w-full rounded-md bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted/70" />
          <div className="h-10 w-full rounded-md bg-muted/50" />
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card className="rounded-md border-border shadow-none">
        <CardContent className="p-12 text-center">
          <Banknote className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">학원비 내역이 없습니다</h3>
          <p className="text-muted-foreground">
            학원비를 청구하시면 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-md border-border shadow-none">
      <CardContent className="p-0">
        <div className="space-y-3 p-3 lg:hidden">
          {payments.map((payment) => {
            const overdue = isOverdue(payment);
            return (
              <article
                key={payment.id}
                className={cn(
                  'overflow-hidden rounded-md border border-border bg-background',
                  overdue && 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20'
                )}
              >
                <button className="block w-full px-4 py-4 text-left" type="button" onClick={() => onPaymentClick(payment.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{payment.student_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{payment.student_number}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-medium ${getPaymentStatusColor(
                        payment.payment_status
                      )}`}
                    >
                      {PAYMENT_STATUS_LABELS[payment.payment_status]}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">청구</p>
                      <p className="mt-1 font-medium text-foreground">{formatYearMonth(payment.year_month)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{PAYMENT_TYPE_LABELS[payment.payment_type]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">금액</p>
                      <p className="mt-1 font-semibold text-foreground">{formatPaymentAmount(payment.final_amount)}</p>
                      {payment.paid_amount > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">납부 {formatPaymentAmount(payment.paid_amount)}</p>
                      ) : null}
                    </div>
                    {!hideDueDate ? (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">납부 기한</p>
                        <p className={cn('mt-1 text-sm text-foreground', overdue && 'font-semibold text-red-600 dark:text-red-300')}>
                          {formatDate(payment.due_date)}
                          {overdue ? ' · 연체' : ''}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </button>

                {(showCreditButton || showPaymentMarkButton) && (
                  <div className="space-y-2 border-t border-border bg-muted/25 px-4 py-3">
                    {renderCreditAction(payment)}
                    {renderPaymentActions(payment)}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                  학생 정보
                </th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                  청구 내역
                </th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                  금액
                </th>
                {!hideDueDate && (
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    납부 기한
                  </th>
                )}
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                  상태
                </th>
                {showCreditButton && (
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    크레딧
                  </th>
                )}
                {showPaymentMarkButton && (
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    납부처리
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((payment) => {
                const overdue = isOverdue(payment);
                return (
                  <tr
                    key={payment.id}
                    onClick={() => onPaymentClick(payment.id)}
                    className={`cursor-pointer transition-colors hover:bg-muted/35 ${
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
                    {!hideDueDate && (
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
                      <td className="px-4 py-4 whitespace-nowrap">{renderCreditAction(payment)}</td>
                    )}
                    {showPaymentMarkButton && onPaymentMark && (
                      <td className="px-4 py-4 whitespace-nowrap">{renderPaymentActions(payment)}</td>
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
