import { CalendarDays, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MobileUnpaidScope } from './mobile-unpaid-types';

interface MobileUnpaidFiltersProps {
  scope: MobileUnpaidScope;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onScopeChange: (scope: MobileUnpaidScope) => void;
}

export function MobileUnpaidFilters({
  scope,
  selectedMonth,
  onMonthChange,
  onScopeChange,
}: MobileUnpaidFiltersProps) {
  return (
    <section
      className="rounded-lg border border-border bg-card p-3"
      aria-label="미납자 조회 범위"
      data-testid="mobile-unpaid-filters"
    >
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={scope === 'today' ? 'default' : 'outline'}
          aria-label="오늘 출석 미납자"
          aria-pressed={scope === 'today'}
          className="h-11 min-w-0 px-2"
          onClick={() => onScopeChange('today')}
        >
          <CalendarDays className="mr-1.5 h-4 w-4 shrink-0" />
          <span className="truncate">오늘 수업</span>
        </Button>
        <Button
          type="button"
          variant={scope === 'month' ? 'default' : 'outline'}
          aria-label="해당 월 전체 미납자"
          aria-pressed={scope === 'month'}
          className="h-11 min-w-0 px-2"
          onClick={() => onScopeChange('month')}
        >
          <UsersRound className="mr-1.5 h-4 w-4 shrink-0" />
          <span className="truncate">월 전체</span>
        </Button>
      </div>

      {scope === 'month' && (
        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
          <label htmlFor="mobile-unpaid-month" className="text-sm font-medium text-secondary-foreground">
            조회 월
          </label>
          <input
            id="mobile-unpaid-month"
            type="month"
            aria-label="조회할 미납 월"
            value={selectedMonth}
            onChange={(event) => {
              if (event.target.value) onMonthChange(event.target.value);
            }}
            className="h-11 min-w-0 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:ring-2 focus:ring-muted-foreground/40"
          />
        </div>
      )}
    </section>
  );
}
