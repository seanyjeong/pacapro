import { CalendarDays, Search, UsersRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { MobileUnpaidScope } from './mobile-unpaid-types';

interface MobileUnpaidFiltersProps {
  query: string;
  scope: MobileUnpaidScope;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onQueryChange: (query: string) => void;
  onScopeChange: (scope: MobileUnpaidScope) => void;
}

const scopeOptions = [
  { value: 'today' as const, label: '오늘 수업', ariaLabel: '오늘 출석 미납자', icon: CalendarDays },
  { value: 'month' as const, label: '월 전체', ariaLabel: '해당 월 전체 미납자', icon: UsersRound },
];

export function MobileUnpaidFilters({
  query,
  scope,
  selectedMonth,
  onMonthChange,
  onQueryChange,
  onScopeChange,
}: MobileUnpaidFiltersProps) {
  return (
    <section
      className="space-y-3 rounded-2xl bg-card p-4"
      aria-label="미납자 조회 범위"
      data-testid="mobile-unpaid-filters"
    >
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {scopeOptions.map((option) => {
          const Icon = option.icon;
          const active = scope === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.ariaLabel}
              aria-pressed={active}
              onClick={() => onScopeChange(option.value)}
              className={cn(
                'flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[15px] font-semibold transition-colors',
                active ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>

      {scope === 'month' && (
        <div className="grid grid-cols-[auto_1fr] items-center gap-3">
          <label htmlFor="mobile-unpaid-month" className="text-sm font-semibold text-secondary-foreground">
            조회 월
          </label>
          <Input
            id="mobile-unpaid-month"
            type="month"
            aria-label="조회할 미납 월"
            value={selectedMonth}
            onChange={(event) => {
              if (event.target.value) onMonthChange(event.target.value);
            }}
            className="dark:[color-scheme:dark]"
          />
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="pl-10"
          placeholder="학생명, 연락처, 월 검색"
          aria-label="미납 학생 검색"
        />
      </div>
    </section>
  );
}
