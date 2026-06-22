import { Calendar, FileSpreadsheet, List, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { IncomeViewMode } from './incomes-types';
import { cn } from '@/lib/utils/cn';

interface IncomesHeaderProps {
  viewMode: IncomeViewMode;
  selectedMonth: string;
  searchQuery: string;
  exporting: boolean;
  showForm: boolean;
  editingId: number | null;
  canEdit: boolean;
  onViewModeChange: (mode: IncomeViewMode) => void;
  onMonthChange: (month: string) => void;
  onSearchChange: (query: string) => void;
  onExport: () => void;
  onCreateClick: () => void;
}

export function IncomesHeader({
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
}: IncomesHeaderProps) {
  return (
    <header className="space-y-4 border-b border-border/70 pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Desk</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수입 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">학원비 수납과 기타 수입을 확인합니다.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end">
          <div className="inline-flex rounded-md border border-border bg-background p-1">
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
          <div className="relative min-w-0 sm:col-span-2 lg:w-[260px] lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              aria-label="수입 검색"
              placeholder="학생, 날짜, 항목 검색"
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
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25 lg:w-auto"
          />
          <Button type="button" variant="outline" onClick={onExport} disabled={exporting} className="w-full lg:w-auto">
            <FileSpreadsheet className={cn('mr-2 h-4 w-4', exporting && 'animate-pulse')} />
            {exporting ? '다운로드 중...' : '엑셀'}
          </Button>
          {canEdit ? (
            <Button type="button" onClick={onCreateClick} className="w-full lg:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {showForm && !editingId ? '취소' : '기타수입 등록'}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
