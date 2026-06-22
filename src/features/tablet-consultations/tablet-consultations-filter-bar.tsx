import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TabletConsultationDateFilter } from './tablet-consultations-utils';

interface TabletConsultationsFilterBarProps {
  dateFilter: TabletConsultationDateFilter;
  search: string;
  onDateFilterChange: (value: TabletConsultationDateFilter) => void;
  onSearchChange: (value: string) => void;
}

export function TabletConsultationsFilterBar({
  dateFilter,
  search,
  onDateFilterChange,
  onSearchChange,
}: TabletConsultationsFilterBarProps) {
  return (
    <section className="rounded-md border border-border bg-background p-3 shadow-none" aria-label="상담 필터">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/30 p-1 lg:w-64">
          <Button
            type="button"
            variant={dateFilter === 'selected' ? 'secondary' : 'ghost'}
            onClick={() => onDateFilterChange('selected')}
            className="h-9"
          >
            선택일
          </Button>
          <Button
            type="button"
            variant={dateFilter === 'all' ? 'secondary' : 'ghost'}
            onClick={() => onDateFilterChange('all')}
            className="h-9"
          >
            전체 보기
          </Button>
        </div>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="학생, 학교, 전화번호 검색"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background pl-10 pr-10 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              aria-label="검색어 지우기"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
