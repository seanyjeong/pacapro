'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Banknote, Bell, Calculator, Percent, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaymentSummary } from './payments-types';

interface PaymentsOperationsBoardProps {
  canEdit: boolean;
  sendingNotification: boolean;
  summary: PaymentSummary;
  viewOnly: boolean;
  onAddPayment: () => void;
  onOpenCalculator: () => void;
  onReload: () => void;
  onSendUnpaid: () => void;
}

export function PaymentsOperationsBoard({
  canEdit,
  sendingNotification,
  summary,
  viewOnly,
  onAddPayment,
  onOpenCalculator,
  onReload,
  onSendUnpaid,
}: PaymentsOperationsBoardProps) {
  return (
    <aside
      aria-label="수납 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="payments-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Finance Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">수납 작업 보드</h2>
        <p className="text-sm text-slate-600">선택월 청구, 미납 알림, 일할계산을 한곳에서 처리합니다.</p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">선택월</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">{summary.selectedYearMonth}</p>
        <p className="mt-1 text-xs text-slate-600">{viewOnly ? '미납 조회 모드' : '청구 및 수납 모드'}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<Banknote className="h-4 w-4" />} label="총 청구" testId="payments-metric-total" value={`${summary.filteredCount}건`} />
        <Metric icon={<AlertCircle className="h-4 w-4" />} label="미납" testId="payments-metric-unpaid" value={`${summary.unpaidCount}건`} />
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
              disabled={sendingNotification || summary.unpaidCount === 0}
              type="button"
              variant="outline"
              onClick={onSendUnpaid}
            >
              <Bell className="h-4 w-4" />
              {sendingNotification ? '알림 발송 중' : `미납 알림 발송 (${summary.unpaidCount}명)`}
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
  testId: string;
  value: string;
}

function Metric({ icon, label, testId, value }: MetricProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3" data-testid={testId}>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
