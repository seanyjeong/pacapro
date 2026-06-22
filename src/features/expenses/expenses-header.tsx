import { Calendar, FileSpreadsheet, List, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { ExpenseViewMode } from './expenses-types';

interface ExpensesHeaderProps {
  viewMode: ExpenseViewMode;
  selectedMonth: string;
  searchQuery: string;
  exporting: boolean;
  showForm: boolean;
  editingId: number | null;
  canEdit: boolean;
  onViewModeChange: (mode: ExpenseViewMode) => void;
  onMonthChange: (month: string) => void;
  onSearchChange: (query: string) => void;
  onExport: () => void;
  onCreateClick: () => void;
}

export function ExpensesHeader({
  viewMode,
  selectedMonth,
  searchQuery,
  exporting,
  showForm,
  editingId,
  canEdit,
  onViewModeChange,
  onMonthChange,
  onSearchChange,
  onExport,
  onCreateClick,
}: ExpensesHeaderProps) {
  return (
    <header className="space-y-4 border-b border-border/70 pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">지출 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">운영비, 환불, 급여 연동 지출</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-background p-1">
            <Button
              type="button"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('list')}
              className="h-8 px-3"
            >
              <List className="mr-1.5 h-4 w-4" />
              리스트
            </Button>
            <Button
              type="button"
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('calendar')}
              className="h-8 px-3"
            >
              <Calendar className="mr-1.5 h-4 w-4" />
              달력
            </Button>
          </div>
          <div className="relative min-w-[220px] flex-1 lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              aria-label="지출 검색"
              placeholder="날짜, 항목, 강사 검색"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>
          <input
            type="month"
            aria-label="조회 월"
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25"
          />
          <Button type="button" variant="outline" onClick={onExport} disabled={exporting}>
            <FileSpreadsheet className={cn('mr-2 h-4 w-4', exporting && 'animate-pulse')} />
            {exporting ? '다운로드 중...' : '엑셀'}
          </Button>
          {canEdit ? (
            <Button type="button" onClick={onCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              {showForm && !editingId ? '취소' : '지출 등록'}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
