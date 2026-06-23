'use client';

import type { ReactNode } from 'react';
import { Calendar, FileSpreadsheet, List, Plus, RefreshCw, Search, TrendingDown, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { ExpenseSummary, ExpenseViewMode } from './expenses-types';
import { formatAmount, getCurrentYearMonth } from './expenses-utils';

interface ExpensesOperationsBoardProps {
  canEdit: boolean;
  editingId: number | null;
  exporting: boolean;
  searchQuery: string;
  selectedMonth: string;
  showForm: boolean;
  summary: ExpenseSummary;
  viewMode: ExpenseViewMode;
  onCreateClick: () => void;
  onExport: () => void;
  onMonthChange: (month: string) => void;
  onSearchChange: (query: string) => void;
  onViewModeChange: (mode: ExpenseViewMode) => void;
}

export function ExpensesOperationsBoard({
  canEdit,
  editingId,
  exporting,
  searchQuery,
  selectedMonth,
  showForm,
  summary,
  viewMode,
  onCreateClick,
  onExport,
  onMonthChange,
  onSearchChange,
  onViewModeChange,
}: ExpensesOperationsBoardProps) {
  return (
    <aside
      aria-label="지출 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="expenses-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Finance Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">지출 작업 보드</h2>
        <p className="text-sm text-slate-600">월별 지출, 환불 대기, 급여 연동 지출을 한곳에서 확인합니다.</p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">현재 보기</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">
          {formatMonth(selectedMonth)} · {viewMode === 'calendar' ? '달력' : '리스트'}
        </p>
        {searchQuery ? <p className="mt-1 text-xs text-slate-600">검색: {searchQuery}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<List className="h-4 w-4" />} label="총 건수" testId="expenses-metric-total" value={`${summary.totalCount}건`} />
        <Metric
          icon={<TrendingDown className="h-4 w-4" />}
          label="총 지출"
          testId="expenses-metric-amount"
          value={`${formatAmount(summary.totalAmount)}원`}
        />
        <Metric icon={<WalletCards className="h-4 w-4" />} label="환불 대기" testId="expenses-metric-refund" value={`${summary.refundPendingCount}건`} />
        <Metric icon={<FileSpreadsheet className="h-4 w-4" />} label="급여 연동" testId="expenses-metric-salary" value={`${summary.salaryLinkedCount}건`} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => onViewModeChange('list')}>
          <List className="mr-2 h-4 w-4" />
          리스트 보기
        </Button>
        <Button type="button" variant={viewMode === 'calendar' ? 'default' : 'outline'} onClick={() => onViewModeChange('calendar')}>
          <Calendar className="mr-2 h-4 w-4" />
          달력 보기
        </Button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="작업 보드 검색"
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="항목, 날짜, 강사 검색"
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <input
          aria-label="작업 보드 조회 월"
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-blue-500/20"
          type="month"
          value={selectedMonth}
          onChange={(event) => onMonthChange(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Button className="w-full justify-start gap-2" type="button" variant="outline" onClick={() => onMonthChange(getCurrentYearMonth())}>
          <RefreshCw className="h-4 w-4" />
          이번 달
        </Button>
        <Button className="w-full justify-start gap-2" disabled={exporting} type="button" variant="outline" onClick={onExport}>
          <FileSpreadsheet className={cn('h-4 w-4', exporting && 'animate-pulse')} />
          {exporting ? '다운로드 중' : '엑셀 다운로드'}
        </Button>
        {canEdit ? (
          <Button className="w-full justify-start gap-2" type="button" onClick={onCreateClick}>
            <Plus className="h-4 w-4" />
            {showForm && !editingId ? '취소' : '지출 등록'}
          </Button>
        ) : null}
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

function formatMonth(yearMonth: string) {
  const [year, month] = yearMonth.split('-');
  return `${year}년 ${Number(month)}월`;
}
