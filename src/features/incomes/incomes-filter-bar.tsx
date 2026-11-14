import { Calendar, List, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { IncomeTabs } from './income-tabs';
import type { IncomeTab, IncomeViewMode } from './incomes-types';
import { getCurrentYearMonth } from './incomes-utils';

const FILTER_FIELD_CLASS =
  'h-11 rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10';

interface IncomesFilterBarProps {
  activeTab: IncomeTab;
  searchQuery: string;
  selectedMonth: string;
  viewMode: IncomeViewMode;
  tuitionCount: number;
  otherCount: number;
  onMonthChange: (month: string) => void;
  onSearchChange: (query: string) => void;
  onTabChange: (tab: IncomeTab) => void;
  onViewModeChange: (mode: IncomeViewMode) => void;
}

export function IncomesFilterBar({
  activeTab,
  searchQuery,
  selectedMonth,
  viewMode,
  tuitionCount,
  otherCount,
  onMonthChange,
  onSearchChange,
  onTabChange,
  onViewModeChange,
}: IncomesFilterBarProps) {
  return (
    <div
      aria-label="수입 필터"
      className="flex flex-wrap items-center gap-2"
      data-testid="incomes-operations-board"
      role="group"
    >
      <div className="inline-flex shrink-0 rounded-xl bg-muted p-1">
        <Button
          type="button"
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          aria-pressed={viewMode === 'list'}
          onClick={() => onViewModeChange('list')}
        >
          <List className="h-4 w-4" />
          리스트
        </Button>
        <Button
          type="button"
          variant={viewMode === 'calendar' ? 'default' : 'ghost'}
          size="sm"
          aria-pressed={viewMode === 'calendar'}
          onClick={() => onViewModeChange('calendar')}
        >
          <Calendar className="h-4 w-4" />
          달력
        </Button>
      </div>
      <div className="relative w-full sm:w-auto sm:min-w-[200px] sm:flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          aria-label="수입 검색"
          placeholder="학생, 날짜, 항목 검색"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-10"
        />
      </div>
      <input
        type="month"
        aria-label="조회 월"
        value={selectedMonth}
        onChange={(event) => onMonthChange(event.target.value)}
        className={cn(FILTER_FIELD_CLASS, 'min-w-0 flex-1 sm:flex-none')}
      />
      <Button type="button" variant="outline" onClick={() => onMonthChange(getCurrentYearMonth())}>
        <RefreshCw className="h-4 w-4" />
        이번 달
      </Button>
      {viewMode === 'list' ? (
        <IncomeTabs activeTab={activeTab} tuitionCount={tuitionCount} otherCount={otherCount} onTabChange={onTabChange} />
      ) : null}
    </div>
  );
}
