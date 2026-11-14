'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Banknote, Bell, Calculator, Percent, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PaymentSummary } from './payments-types';
import type { PaymentFilters } from '@/lib/types/payment';

interface PaymentsOperationsBoardProps {
  canEdit: boolean;
  sendingNotification: boolean;
  summary: PaymentSummary;
  viewOnly: boolean;
  filters: PaymentFilters;
  onAddPayment: () => void;
  onFilterChange: (filters: Partial<PaymentFilters>) => void;
  onOpenCalculator: () => void;
  onReload: () => void;
  onSendUnpaid: () => void;
}

export function PaymentsOperationsBoard({
  canEdit,
  sendingNotification,
  summary,
  viewOnly,
  filters,
  onAddPayment,
  onFilterChange,
  onOpenCalculator,
  onReload,
  onSendUnpaid,
}: PaymentsOperationsBoardProps) {
  return (
    <aside
      aria-label="수납 작업 보드"
      className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm"
      data-testid="payments-operations-board"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-normal text-foreground">수납 작업 보드</h2>
        <p className="text-sm text-secondary-foreground">선택월 청구, 미납 알림, 일할계산을 한곳에서 처리합니다.</p>
      </div>

      <div className="rounded-md border border-border bg-muted p-3">
        <p className="text-xs font-medium text-muted-foreground">선택월</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{summary.selectedYearMonth}</p>
        <p className="mt-1 text-xs text-secondary-foreground">{viewOnly ? '미납 조회 모드' : '청구 및 수납 모드'}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={<Banknote className="h-4 w-4" />}
          label="총 청구"
          selected={!filters.payment_status}
          testId="payments-metric-total"
          value={`${summary.filteredCount}건`}
          onClick={() => onFilterChange({ payment_status: undefined })}
        />
        <Metric
          icon={<AlertCircle className="h-4 w-4" />}
          label="미납"
          selected={filters.payment_status === 'pending'}
          testId="payments-metric-unpaid"
          value={`${summary.unpaidCount}건`}
          onClick={() => onFilterChange({ payment_status: 'pending' })}
        />
        <Metric
          icon={<RefreshCw className="h-4 w-4" />}
          label="전달 미납"
          testId="payments-metric-previous"
          value={`${summary.previousUnpaidPayments.length}건`}
        />
        <Metric icon={<Percent className="h-4 w-4" />} label="납부율" testId="payments-metric-rate" value={`${summary.paidRate}%`} />
      </div>

      <div className="grid gap-2">
        <Button className="w-full justify-start gap-2" type="button" variant="outline" onClick={onOpenCalculator}>
          <Calculator className="h-4 w-4" />
          일할계산 열기
        </Button>
        {canEdit ? (
          <>
            <Button
              className="w-full justify-start gap-2"
              disabled={sendingNotification || summary.unpaidNotifyCount === 0}
              type="button"
              variant="outline"
              onClick={onSendUnpaid}
            >
              <Bell className="h-4 w-4" />
              {sendingNotification ? '알림 발송 중' : `미납 알림 발송 (${summary.unpaidNotifyCount}명)`}
            </Button>
            <Button className="w-full justify-start gap-2" type="button" onClick={onAddPayment}>
              <Plus className="h-4 w-4" />
              신규 학원비 청구
            </Button>
          </>
        ) : null}
        <Button className="w-full justify-start gap-2" type="button" variant="ghost" onClick={onReload}>
          <RefreshCw className="h-4 w-4" />
          새로고침
        </Button>
      </div>
    </aside>
  );
}

interface MetricProps {
  icon: ReactNode;
  label: string;
  selected?: boolean;
  testId: string;
  value: string;
  onClick?: () => void;
}

function Metric({ icon, label, selected = false, testId, value, onClick }: MetricProps) {
  const className = cn(
    'rounded-md border border-border bg-muted p-3 text-left transition',
    onClick && 'hover:border-border hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground/40',
    selected && 'border-primary/30 bg-primary-soft text-primary'
  );
  const content = (
    <>
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-foreground">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button aria-pressed={selected} className={className} data-testid={testId} type="button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className={className} data-testid={testId}>
      {content}
    </div>
  );
}
