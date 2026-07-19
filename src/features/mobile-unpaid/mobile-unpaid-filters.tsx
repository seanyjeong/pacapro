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
      className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
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
          <label htmlFor="mobile-unpaid-month" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
            className="h-11 min-w-0 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-zinc-200"
          />
        </div>
      )}
    </section>
  );
}
