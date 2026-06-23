'use client';

import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle, FileDown, FileSpreadsheet, RefreshCw, RotateCcw, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Instructor } from '@/lib/types/instructor';
import { PAYMENT_STATUS_LABELS, type SalaryFilters } from '@/lib/types/salary';
import { cn } from '@/lib/utils';
import type { SalarySummary } from './salaries-page-types';
import { formatWon, getCurrentFilterYearMonth } from './salaries-page-utils';

interface SalariesOperationsBoardProps {
  bulkPaying: boolean;
  exporting: boolean;
  filters: SalaryFilters;
  instructors: Instructor[];
  loading: boolean;
  pdfExporting: boolean;
  pdfProgress: { current: number; total: number };
  summary: SalarySummary;
  onBulkPay: () => void;
  onDefaultMonth: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onFilterChange: (filters: Partial<SalaryFilters>) => void;
  onReload: () => void;
}

export function SalariesOperationsBoard({
  bulkPaying,
  exporting,
  filters,
  instructors,
  loading,
  pdfExporting,
  pdfProgress,
  summary,
  onBulkPay,
  onDefaultMonth,
  onExportExcel,
  onExportPDF,
  onFilterChange,
  onReload,
}: SalariesOperationsBoardProps) {
  const disableExport = summary.totalCount === 0;

  return (
    <aside
      aria-label="급여 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="salaries-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Finance Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">급여 작업 보드</h2>
        <p className="text-sm text-slate-600">선택 월 급여, 지급 대기, 명세서 다운로드를 한곳에서 처리합니다.</p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">현재 보기</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">{formatCurrentView(filters, instructors)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={<WalletCards className="h-4 w-4" />}
          label="전체"
          selected={!filters.payment_status}
          testId="salaries-metric-total"
          value={`${summary.totalCount}건`}
          onClick={() => onFilterChange({ payment_status: undefined })}
        />
        <Metric
          icon={<AlertCircle className="h-4 w-4" />}
          label="지급 대기"
          selected={filters.payment_status === 'pending'}
          testId="salaries-metric-pending"
          value={`${summary.pendingCount}건`}
          onClick={() => onFilterChange({ payment_status: 'pending' })}
        />
        <Metric icon={<FileDown className="h-4 w-4" />} label="미지급액" testId="salaries-metric-unpaid" value={formatWon(summary.totalUnpaid)} />
        <Metric
          icon={<CheckCircle className="h-4 w-4" />}
          label="지급 완료"
          selected={filters.payment_status === 'paid'}
          testId="salaries-metric-paid"
          value={`${summary.paidCount}건`}
          onClick={() => onFilterChange({ payment_status: 'paid' })}
        />
      </div>

      <div className="grid gap-2">
        <Button
          className="w-full justify-start gap-2"
          type="button"
          variant="outline"
          onClick={() => onFilterChange({ payment_status: 'pending' })}
        >
          <AlertCircle className="h-4 w-4" />
          지급 대기 보기
        </Button>
        <Button
          className="w-full justify-start gap-2"
          type="button"
          variant="outline"
          onClick={() => onFilterChange({ payment_status: 'paid' })}
        >
          <CheckCircle className="h-4 w-4" />
          지급 완료 보기
        </Button>
        <Button className="w-full justify-start gap-2" type="button" variant="outline" onClick={onDefaultMonth}>
          <RotateCcw className="h-4 w-4" />
          오늘 기준
        </Button>
        <Button className="w-full justify-start gap-2" disabled={bulkPaying || summary.pendingCount === 0} type="button" onClick={onBulkPay}>
          <CheckCircle className="h-4 w-4" />
          {bulkPaying ? '처리 중' : `모두 지급처리 (${summary.pendingCount}건)`}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button className="justify-start gap-2" disabled={pdfExporting || disableExport} type="button" variant="outline" onClick={onExportPDF}>
          <FileDown className="h-4 w-4" />
          {pdfExporting ? `${pdfProgress.current}/${pdfProgress.total}` : 'PDF'}
        </Button>
        <Button className="justify-start gap-2" disabled={exporting} type="button" variant="outline" onClick={onExportExcel}>
          <FileSpreadsheet className="h-4 w-4" />
          {exporting ? '다운로드 중' : '엑셀'}
        </Button>
        <Button className="col-span-2 justify-start gap-2" disabled={loading} type="button" variant="ghost" onClick={onReload}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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
    'rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition',
    onClick && 'hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900',
    selected && 'border-blue-300 bg-blue-50 text-blue-950'
  );
  const content = (
    <>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{value}</p>
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

function formatCurrentView(filters: SalaryFilters, instructors: Instructor[]) {
  const monthLabel = formatMonth(filters);
  const instructorLabel = instructors.find((instructor) => instructor.id === filters.instructor_id)?.name || '강사 전체';
  const statusLabel = filters.payment_status ? PAYMENT_STATUS_LABELS[filters.payment_status] : '지급 상태 전체';
  return `${monthLabel} · ${instructorLabel} · ${statusLabel}`;
}

function formatMonth(filters: SalaryFilters) {
  const yearMonth = getCurrentFilterYearMonth(filters);
  if (!yearMonth) return '전체 월';
  const [year, month] = yearMonth.split('-');
  return `${year}년 ${Number(month)}월`;
}
