import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <section className="border-b border-zinc-200 bg-white px-4 pb-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950" data-testid="mobile-consultations-calendar">
      <div className="flex items-center justify-between py-3">
        <Button variant="ghost" size="icon" onClick={() => onMonthMove(-1)} aria-label="이전 달">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {calendarMonth.year}년 {calendarMonth.month + 1}월
        </span>
        <Button variant="ghost" size="icon" onClick={() => onMonthMove(1)} aria-label="다음 달">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7">
        {DOW_LABELS.map((label, index) => (
          <div
            key={label}
            className={`py-1 text-center text-xs font-medium ${index === 5 ? 'text-sky-500' : index === 6 ? 'text-rose-500' : 'text-zinc-500'}`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {monthGrid.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="h-11" />;
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
              className={`relative flex h-11 flex-col items-center justify-center rounded-lg text-sm transition
                ${selected ? 'bg-zinc-950 font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950' : ''}
                ${!selected && isToday ? 'ring-2 ring-emerald-500 ring-inset' : ''}
                ${!selected ? 'hover:bg-zinc-100 dark:hover:bg-zinc-900' : ''}
                ${!selected && dow === 5 ? 'text-sky-500' : ''}
                ${!selected && dow === 6 ? 'text-rose-500' : ''}
              `}
            >
              <span>{date.getDate()}</span>
              {count > 0 && (
                <span className={`absolute bottom-1 text-[10px] font-semibold leading-none ${selected ? 'text-white/75 dark:text-zinc-950/70' : 'text-emerald-600 dark:text-emerald-400'}`}>
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
