import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { DOW_LABELS } from './mobile-consultations-constants';
import type { CalendarMonth } from './mobile-consultations-types';
import { getMonthGrid, toLocalDateStr } from './mobile-consultations-utils';

interface MobileConsultationsCalendarProps {
  calendarMonth: CalendarMonth;
  monthCounts: Record<string, number>;
  selectedDate: Date;
  today: Date;
  onDateSelect: (date: Date) => void;
  onMonthMove: (offset: number) => void;
}

export function MobileConsultationsCalendar({
  calendarMonth,
  monthCounts,
  selectedDate,
  today,
  onDateSelect,
  onMonthMove,
}: MobileConsultationsCalendarProps) {
  const monthGrid = getMonthGrid(calendarMonth.year, calendarMonth.month);
  const selectedDateKey = toLocalDateStr(selectedDate);
  const todayKey = toLocalDateStr(today);

  return (
    <section className="rounded-2xl bg-card p-3" data-testid="mobile-consultations-calendar">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => onMonthMove(-1)} aria-label="이전 달">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-[17px] font-bold text-foreground">
          {calendarMonth.year}년 {calendarMonth.month + 1}월
        </span>
        <Button variant="ghost" size="icon" onClick={() => onMonthMove(1)} aria-label="다음 달">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="mt-1 grid grid-cols-7">
        {DOW_LABELS.map((label, index) => (
          <div
            key={label}
            className={cn('py-1.5 text-center text-xs font-semibold', index === 5 ? 'text-primary' : index === 6 ? 'text-destructive' : 'text-muted-foreground')}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {monthGrid.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="h-12" />;
          const dateKey = toLocalDateStr(date);
          const count = monthCounts[dateKey] || 0;
          const selected = selectedDateKey === dateKey;
          const isToday = todayKey === dateKey;
          const dow = index % 7;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onDateSelect(date)}
              aria-pressed={selected}
              className={cn(
                'relative mx-auto flex h-12 w-12 flex-col items-center justify-center rounded-full text-[15px] transition-colors',
                selected ? 'bg-primary font-bold text-primary-foreground' : 'hover:bg-muted',
                !selected && isToday && 'font-bold text-primary ring-2 ring-inset ring-primary/40',
                !selected && !isToday && dow === 5 && 'text-primary',
                !selected && !isToday && dow === 6 && 'text-destructive'
              )}
            >
              <span>{date.getDate()}</span>
              {count > 0 && (
                <span className={cn('absolute bottom-1 text-[10px] font-bold leading-none', selected ? 'text-primary-foreground/80' : 'text-success')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Button variant="secondary" className="mt-3 w-full" onClick={() => onDateSelect(today)}>
        오늘로 이동
      </Button>
    </section>
  );
}
