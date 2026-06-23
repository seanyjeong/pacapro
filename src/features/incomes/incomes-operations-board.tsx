'use client';

import type { ReactNode } from 'react';
import { Banknote, Calendar, CreditCard, FileSpreadsheet, List, Plus, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { IncomeSummary, IncomeTab, IncomeViewMode } from './incomes-types';
import { formatAmount, getCurrentYearMonth } from './incomes-utils';

interface IncomesOperationsBoardProps {
  activeTab: IncomeTab;
  canEdit: boolean;
  editingId: number | null;
  exporting: boolean;
  searchQuery: string;
  selectedMonth: string;
  showForm: boolean;
  summary: IncomeSummary;
  viewMode: IncomeViewMode;
  onCreateClick: () => void;
  onExport: () => void;
  onMonthChange: (month: string) => void;
  onSearchChange: (query: string) => void;
  onTabChange: (tab: IncomeTab) => void;
  onViewModeChange: (mode: IncomeViewMode) => void;
}

export function IncomesOperationsBoard({
  activeTab,
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
  onTabChange,
  onViewModeChange,
}: IncomesOperationsBoardProps) {
  return (
    <aside
      aria-label="수입 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="incomes-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Finance Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">수입 작업 보드</h2>
        <p className="text-sm text-slate-600">학원비 수납, 기타수입, 월별 수입 비율을 한곳에서 확인합니다.</p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">현재 보기</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">
          {formatMonth(selectedMonth)} · {getTabLabel(activeTab)} · {viewMode === 'calendar' ? '달력' : '리스트'}
        </p>
        {searchQuery ? <p className="mt-1 text-xs text-slate-600">검색: {searchQuery}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          active={activeTab === 'all'}
          ariaLabel="전체 수입 보기"
          icon={<TrendingUp className="h-4 w-4" />}
          label="총 수입"
          testId="incomes-metric-total"
          value={`${formatAmount(summary.totalIncome)}원`}
          onClick={() => onTabChange('all')}
        />
        <Metric
          active={activeTab === 'tuition'}
          ariaLabel="학원비 수입 보기"
          icon={<CreditCard className="h-4 w-4" />}
          label="학원비"
          testId="incomes-metric-tuition"
          value={`${summary.tuitionCount}건`}
          onClick={() => onTabChange('tuition')}
        />
        <Metric
          active={activeTab === 'other'}
          ariaLabel="기타 수입 보기"
          icon={<Banknote className="h-4 w-4" />}
          label="기타"
          testId="incomes-metric-other"
          value={`${summary.otherCount}건`}
          onClick={() => onTabChange('other')}
        />
        <Metric icon={<List className="h-4 w-4" />} label="학원비 비율" testId="incomes-metric-ratio" value={`${summary.tuitionRatio}%`} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button type="button" variant={activeTab === 'all' ? 'default' : 'outline'} onClick={() => onTabChange('all')}>
          전체 보기
        </Button>
        <Button type="button" variant={activeTab === 'tuition' ? 'default' : 'outline'} onClick={() => onTabChange('tuition')}>
          학원비 보기
        </Button>
        <Button type="button" variant={activeTab === 'other' ? 'default' : 'outline'} onClick={() => onTabChange('other')}>
          기타 보기
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => onViewModeChange('list')}>
          <List className="mr-2 h-4 w-4" />
          리스트
        </Button>
        <Button type="button" variant={viewMode === 'calendar' ? 'default' : 'outline'} onClick={() => onViewModeChange('calendar')}>
          <Calendar className="mr-2 h-4 w-4" />
          달력
        </Button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="작업 보드 수입 검색"
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="학생, 날짜, 항목 검색"
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
            {showForm && !editingId ? '취소' : '기타수입 등록'}
          </Button>
        ) : null}
      </div>
    </aside>
  );
}

interface MetricProps {
  active?: boolean;
  ariaLabel?: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  testId: string;
  value: string;
}

function Metric({ active, ariaLabel, icon, label, onClick, testId, value }: MetricProps) {
  const content = (
    <>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </>
  );

  if (!onClick) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3" data-testid={testId}>
        {content}
      </div>
    );
  }

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={Boolean(active)}
      className={cn(
        'rounded-md border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500/25',
        active
          ? 'border-blue-300 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
      )}
      data-testid={testId}
      type="button"
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function formatMonth(yearMonth: string) {
  const [year, month] = yearMonth.split('-');
  return `${year}년 ${Number(month)}월`;
}

function getTabLabel(tab: IncomeTab) {
  if (tab === 'tuition') return '학원비';
  if (tab === 'other') return '기타';
  return '전체';
}
