import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { TabletConsultationDateFilter } from './tablet-consultations-utils';

interface TabletConsultationsFilterBarProps {
  dateFilter: TabletConsultationDateFilter;
  search: string;
  onDateFilterChange: (value: TabletConsultationDateFilter) => void;
  onSearchChange: (value: string) => void;
}

const DATE_FILTERS: { value: TabletConsultationDateFilter; label: string }[] = [
  { value: 'selected', label: '선택일' },
  { value: 'all', label: '전체 보기' },
];

/** 상담 목록 카드 맨 위 필터 줄 */
export function TabletConsultationsFilterBar({
  dateFilter,
  search,
  onDateFilterChange,
  onSearchChange,
}: TabletConsultationsFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center" aria-label="상담 필터" role="search">
      <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-muted p-1 lg:w-60">
        {DATE_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={dateFilter === option.value}
            onClick={() => onDateFilterChange(option.value)}
            className={cn(
              'h-9 rounded-lg text-sm font-semibold transition-colors',
              dateFilter === option.value ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="학생, 학교, 전화번호 검색"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-10 pr-10"
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
  );
}
