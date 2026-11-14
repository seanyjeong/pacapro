import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { CALENDAR_PREVIEW_LIMIT, CALENDAR_WEEKDAYS, MAX_CALENDAR_MONTH, MIN_CALENDAR_MONTH } from './mobile-calendar-constants';
import { monthCells } from './mobile-calendar-utils';

interface MobileMonthCalendarProps {
  month: string;
  today: string;
  selectedDate: string;
  entries: Record<string, string[]>;
  loading: boolean;
  onDateSelect: (date: string) => void;
  onMonthMove: (offset: number) => void;
  onToday: () => void;
}

export function MobileMonthCalendar(props: MobileMonthCalendarProps) {
  const [year, month] = props.month.split('-').map(Number);
  return (
    <section aria-label="월간 달력" aria-busy={props.loading} className="rounded-2xl bg-card p-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="이전 달" disabled={props.month <= MIN_CALENDAR_MONTH} onClick={() => props.onMonthMove(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-[17px] font-bold" aria-live="polite">{year}년 {month}월</h2>
        <Button variant="ghost" size="icon" aria-label="다음 달" disabled={props.month >= MAX_CALENDAR_MONTH} onClick={() => props.onMonthMove(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="mt-1 grid grid-cols-7">
        {CALENDAR_WEEKDAYS.map(day => <span key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground">{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthCells(props.month).map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="min-h-[72px]" />;
          const entries = props.entries[date] || [];
          const selected = date === props.selectedDate;
          const isToday = date === props.today;
          return (
            <button
              type="button" key={date} aria-pressed={selected} aria-current={isToday ? 'date' : undefined}
              aria-label={`${date}${entries.length ? `, ${entries.join(', ')}` : ''}`}
              onClick={() => props.onDateSelect(date)}
              className={cn('flex min-h-[72px] min-w-0 touch-manipulation flex-col items-center gap-0.5 overflow-hidden rounded-xl px-0.5 py-1.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                selected ? 'bg-primary-soft' : 'hover:bg-muted')}
            >
              <span className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold',
                isToday ? 'bg-primary text-primary-foreground' : selected ? 'text-primary' : 'text-foreground'
              )}>
                {Number(date.slice(-2))}
              </span>
              {!props.loading && entries.slice(0, CALENDAR_PREVIEW_LIMIT).map((entry, entryIndex) => (
                <span key={entryIndex} className="block w-full truncate rounded-md bg-muted px-1 text-center text-[11px] leading-4 text-secondary-foreground">{entry}</span>
              ))}
              {!props.loading && entries.length > CALENDAR_PREVIEW_LIMIT && (
                <span className="text-center text-[11px] font-semibold text-muted-foreground">+{entries.length - CALENDAR_PREVIEW_LIMIT}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[13px] text-muted-foreground">날짜를 누르면 상세 일정이 보여요.</p>
        <Button variant="secondary" className="shrink-0" onClick={props.onToday}>오늘</Button>
      </div>
    </section>
  );
}
