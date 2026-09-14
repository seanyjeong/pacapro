/**
 * Payment List Component
 * 학원비 목록 컴포넌트
 */

'use client';

import { StudentParentNames } from '@/components/students/student-parent-names';
import { useMemo, useState } from 'react';
import { getAmountView } from './payment-amount-view';
import { PaymentListTable } from './payment-list-table';
import type { PaymentSortKey, SortDir } from './payment-sort-header';
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
import {
  Coins,
  Check,
  Loader2,
  CreditCard,
  Banknote,
  Wallet,
  FilePenLine,
} from 'lucide-react';
import type { Payment } from '@/lib/types/payment';
import { cn } from '@/lib/utils/cn';
import {
  formatPaymentAmount,
  formatYearMonth,
  formatDate,
  getPaymentStatusColor,
  getPaidPaymentAmount,
  getRemainingPaymentAmount,
  isOverdue,
  isSeasonUpcoming,
} from '@/lib/utils/payment-helpers';
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
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
  /** 상세 납부하기 모달 (금액/할인/일자 입력) */
  onDetailedPay?: (payment: Payment) => void;
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
  onDetailedPay,
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
  const [sortKey, setSortKey] = useState<PaymentSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: PaymentSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedPayments = useMemo(() => {
    if (!sortKey) return payments;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...payments].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'student':
          cmp = (a.student_name || '').localeCompare(b.student_name || '', 'ko');
          break;
        case 'billing':
          cmp = (a.year_month || '').localeCompare(b.year_month || '')
            || (a.payment_type || '').localeCompare(b.payment_type || '');
          break;
        case 'amount':
          cmp = (Number(a.final_amount) || 0) - (Number(b.final_amount) || 0);
          break;
        case 'due':
          cmp = (a.due_date || '').localeCompare(b.due_date || '');
          break;
        case 'status':
          cmp = (a.payment_status || '').localeCompare(b.payment_status || '');
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
  }, [payments, sortKey, sortDir]);

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
    const creditAmount = Math.floor(Number(payment.credit_balance) || 0);
    const creditLabel = creditAmount > 0 ? `${creditAmount.toLocaleString()}원` : null;
    return (
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onCreditClick(payment);
          }}
          className="h-7 shrink-0 border-blue-200 bg-blue-50 px-2 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        >
          <Coins className="mr-1 h-3.5 w-3.5" />
          크레딧
        </Button>
        {creditLabel ? (
          <span
            className="inline-flex max-w-full items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums leading-tight text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            title={`잔여 크레딧 ${creditLabel}`}
          >
            {creditLabel}
          </span>
        ) : null}
      </div>
    );
  };

  const renderPaymentActions = (payment: Payment) => {
    if (!showPaymentMarkButton || (!onPaymentMark && !onDetailedPay)) return null;
    if (payment.payment_status === 'paid') {
      return (
        <span className="inline-flex h-8 min-w-[88px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-medium leading-none text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          <span className="tracking-wide">완납</span>
        </span>
      );
    }

    if (markingPaymentId === payment.id) {
      return (
        <span className="inline-flex h-8 min-w-[96px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-muted px-3.5 text-sm font-medium leading-none text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span>처리중...</span>
        </span>
      );
    }

    return (
      <div className="flex min-w-0 flex-col items-stretch gap-1.5">
        {onPaymentMark ? (
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">빠른납부</p>
            <div className="inline-flex flex-wrap items-center gap-1">
              {PAYMENT_ACTIONS.map(({ method, label, Icon, className }) => (
                <Button
                  key={method}
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePaymentMarkClick(payment, method);
                  }}
                  className={cn(
                    'h-7 min-w-[48px] shrink-0 gap-0.5 border px-2 text-[11px] font-semibold shadow-none active:scale-95',
                    className
                  )}
                  title={`${methodLabels[method]}로 전액 빠른 납부`}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="shrink-0">{label}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {onDetailedPay ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onDetailedPay(payment);
            }}
            className="h-7 w-full justify-center gap-1 border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-none hover:bg-slate-50"
            title="금액·할인·납부일 입력"
          >
            <FilePenLine className="h-3 w-3 shrink-0" />
            상세납부
          </Button>
        ) : null}
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
          {sortedPayments.map((payment) => {
            const overdue = isOverdue(payment);
            const upcomingSeason = isSeasonUpcoming(payment);
            const paidAmount = getPaidPaymentAmount(payment);
            const remainingAmount = getRemainingPaymentAmount(payment);
            const amountView = getAmountView(payment, paidAmount, remainingAmount);
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
                      <StudentParentNames student={payment} />
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-medium ${getPaymentStatusColor(
                        payment.payment_status
                      )}`}
                    >
                      {PAYMENT_STATUS_LABELS[payment.payment_status]}
                      {upcomingSeason ? ' · 납부예정' : ''}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">청구</p>
                      <p className="mt-1 font-medium text-foreground">{formatYearMonth(payment.year_month)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{PAYMENT_TYPE_LABELS[payment.payment_type]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{amountView.label}</p>
                      <p className={`mt-1 font-semibold ${amountView.tone}`}>{formatPaymentAmount(amountView.amount)}</p>
                      {amountView.detail ? <p className="mt-1 text-xs text-muted-foreground">{amountView.detail}</p> : null}
                    </div>
                    {!hideDueDate ? (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">납부 기한</p>
                        <p className={cn('mt-1 text-sm text-foreground', overdue && 'font-semibold text-red-600 dark:text-red-300')}>
                          {formatDate(payment.due_date)}
                          {upcomingSeason ? ' · 납부예정' : overdue ? ' · 연체' : ''}
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

        <PaymentListTable
          sortedPayments={sortedPayments} onPaymentClick={onPaymentClick}
          sortKey={sortKey} sortDir={sortDir} handleSort={handleSort}
          hideDueDate={hideDueDate} showCreditButton={showCreditButton}
          showPaymentMarkButton={showPaymentMarkButton}
          onCreditClick={Boolean(onCreditClick)} onPaymentMark={Boolean(onPaymentMark)}
          renderCreditAction={renderCreditAction} renderPaymentActions={renderPaymentActions}
        />
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
                  <span className="font-semibold">{formatYearMonth(pendingPayment.payment.year_month)}</span> 남은 학원비{' '}
                  <span className="font-semibold text-primary">{formatPaymentAmount(getRemainingPaymentAmount(pendingPayment.payment))}</span>을{' '}
                  <span className="font-semibold text-blue-600">{methodLabels[pendingPayment.method]}</span>로 납부 처리하시겠습니까?
                </>
              )}
            </AlertDialogDescription>
            {pendingPayment && <StudentParentNames student={pendingPayment.payment} />}
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
