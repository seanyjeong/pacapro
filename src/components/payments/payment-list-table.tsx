import { StudentParentNames } from '@/components/students/student-parent-names';
import type { ReactNode } from 'react';
import type { Payment } from '@/lib/types/payment';
import { PAYMENT_TYPE_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/types/payment';
import { cn } from '@/lib/utils/cn';
import { formatPaymentAmount, formatYearMonth, formatDate, getPaymentStatusColor, getPaymentTypeColor, getPaidPaymentAmount, getRemainingPaymentAmount, isOverdue, isSeasonUpcoming } from '@/lib/utils/payment-helpers';
import { getAmountView } from './payment-amount-view';
import { PaymentSortHeader, type PaymentSortKey, type SortDir } from './payment-sort-header';

interface PaymentListTableProps {
  sortedPayments: Payment[];
  onPaymentClick: (id: number) => void;
  sortKey: PaymentSortKey | null;
  sortDir: SortDir;
  handleSort: (key: PaymentSortKey) => void;
  hideDueDate: boolean;
  showCreditButton: boolean;
  showPaymentMarkButton: boolean;
  onCreditClick: boolean;
  onPaymentMark: boolean;
  renderCreditAction: (payment: Payment) => ReactNode;
  renderPaymentActions: (payment: Payment) => ReactNode;
}

export function PaymentListTable({ sortedPayments, onPaymentClick, sortKey, sortDir, handleSort, hideDueDate, showCreditButton, showPaymentMarkButton, onCreditClick, onPaymentMark, renderCreditAction, renderPaymentActions }: PaymentListTableProps) {
  return (
        <div className="hidden overflow-x-auto lg:block">
          <table className={cn('w-full table-fixed text-sm', showPaymentMarkButton ? 'min-w-[1040px]' : 'min-w-[820px]')}>
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
              {!hideDueDate ? <col style={{ width: '11%' }} /> : null}
              <col style={{ width: '10%' }} />
              {showCreditButton ? <col style={{ width: '14%' }} /> : null}
              {showPaymentMarkButton ? <col style={{ width: '23%' }} /> : null}
            </colgroup>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <PaymentSortHeader
                  label="학생 정보"
                  column="student"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="px-3"
                />
                <PaymentSortHeader
                  label="청구 내역"
                  column="billing"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="px-3"
                />
                <PaymentSortHeader
                  label="금액"
                  column="amount"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="px-3"
                />
                {!hideDueDate && (
                  <PaymentSortHeader
                    label="납부 기한"
                    column="due"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="px-3"
                  />
                )}
                <PaymentSortHeader
                  label="상태"
                  column="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="px-3"
                />
                {showCreditButton && (
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                    크레딧
                  </th>
                )}
                {showPaymentMarkButton && (
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                    납부처리
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedPayments.map((payment) => {
                const overdue = isOverdue(payment);
                const upcomingSeason = isSeasonUpcoming(payment);
                const paidAmount = getPaidPaymentAmount(payment);
                const remainingAmount = getRemainingPaymentAmount(payment);
                const amountView = getAmountView(payment, paidAmount, remainingAmount);
                return (
                  <tr
                    key={payment.id}
                    onClick={() => onPaymentClick(payment.id)}
                    className={`cursor-pointer transition-colors hover:bg-muted/35 ${
                      overdue ? 'bg-red-50 dark:bg-red-950' : ''
                    }`}
                  >
                    <td className="px-3 py-3 align-middle">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{payment.student_name}</div>
                        <div className="truncate text-xs text-muted-foreground">{payment.student_number}</div>
                        <StudentParentNames student={payment} />
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${getPaymentTypeColor(
                              payment.payment_type
                            )}`}
                          >
                            {PAYMENT_TYPE_LABELS[payment.payment_type]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatYearMonth(payment.year_month)}
                          </span>
                        </div>
                        {payment.description ? (
                          <div
                            className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground"
                            title={payment.description}
                          >
                            {payment.description}
                          </div>
                        ) : null}
                        {payment.notes && payment.notes !== payment.description ? (
                          <div
                            className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-muted-foreground/80"
                            title={payment.notes}
                          >
                            {payment.notes}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="min-w-0">
                        <div className="text-[11px] text-muted-foreground">{amountView.label}</div>
                        <div
                          className={`text-sm font-semibold tabular-nums ${amountView.tone}`}
                          title={formatPaymentAmount(amountView.amount)}
                        >
                          {formatPaymentAmount(amountView.amount)}
                        </div>
                        {amountView.detail ? (
                          <div className="line-clamp-2 text-[11px] leading-snug text-muted-foreground" title={amountView.detail}>
                            {amountView.detail}
                          </div>
                        ) : null}
                        {(payment.discount_amount > 0 || payment.additional_amount > 0) && payment.base_amount !== payment.final_amount ? (
                          <div
                            className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground"
                            title={[
                              `기본 ${formatPaymentAmount(payment.base_amount)}`,
                              payment.discount_amount > 0 ? `할인 -${formatPaymentAmount(payment.discount_amount)}` : '',
                              payment.additional_amount > 0
                                ? `${payment.notes?.includes('비시즌 종강 일할') ? '비시즌 일할' : '추가'} +${formatPaymentAmount(payment.additional_amount)}`
                                : '',
                            ].filter(Boolean).join(' · ')}
                          >
                            {payment.discount_amount > 0 ? `할인 -${formatPaymentAmount(payment.discount_amount)}` : null}
                            {payment.discount_amount > 0 && payment.additional_amount > 0 ? ' · ' : null}
                            {payment.additional_amount > 0
                              ? `${payment.notes?.includes('비시즌 종강 일할') ? '일할' : '추가'} +${formatPaymentAmount(payment.additional_amount)}`
                              : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    {!hideDueDate && (
                      <td className="px-3 py-3 align-middle">
                        <div className={cn('text-sm tabular-nums', overdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-foreground')}>
                          {formatDate(payment.due_date)}
                        </div>
                        {payment.paid_date ? (
                          <div className="text-[11px] text-green-600 dark:text-green-400">
                            납부 {formatDate(payment.paid_date)}
                          </div>
                        ) : null}
                        {overdue ? (
                          <div className="mt-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">연체</div>
                        ) : null}
                        {upcomingSeason ? (
                          <div className="mt-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-300">납부예정</div>
                        ) : null}
                      </td>
                    )}
                    <td className="px-3 py-3 align-middle">
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <span
                          className={cn(
                            'inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-none tracking-wide',
                            getPaymentStatusColor(payment.payment_status)
                          )}
                        >
                          <span className="truncate">
                            {PAYMENT_STATUS_LABELS[payment.payment_status]}
                            {upcomingSeason ? ' · 예정' : ''}
                          </span>
                        </span>
                        {payment.payment_method && payment.payment_status === 'paid' ? (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[payment.payment_method]}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {showCreditButton && onCreditClick ? (
                      <td className="px-3 py-3 align-middle">{renderCreditAction(payment)}</td>
                    ) : null}
                    {showPaymentMarkButton && onPaymentMark ? (
                      <td className="px-3 py-3 align-middle">{renderPaymentActions(payment)}</td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
  );
}
