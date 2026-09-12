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
    <section aria-label="월간 달력" aria-busy={props.loading} className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-2 py-2">
        <Button variant="ghost" size="icon" aria-label="이전 달" disabled={props.month <= MIN_CALENDAR_MONTH} onClick={() => props.onMonthMove(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-base font-semibold" aria-live="polite">{year}년 {month}월</h2>
        <Button variant="ghost" size="icon" aria-label="다음 달" disabled={props.month >= MAX_CALENDAR_MONTH} onClick={() => props.onMonthMove(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 border-b border-border">
        {CALENDAR_WEEKDAYS.map(day => <span key={day} className="py-2 text-center text-xs text-muted-foreground">{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {monthCells(props.month).map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="min-h-20 bg-muted" />;
          const entries = props.entries[date] || [];
          const selected = date === props.selectedDate;
          return (
            <button
              type="button" key={date} aria-pressed={selected} aria-current={date === props.today ? 'date' : undefined}
              aria-label={`${date}${entries.length ? `, ${entries.join(', ')}` : ''}`}
              onClick={() => props.onDateSelect(date)}
              className={cn('flex min-h-20 min-w-0 touch-manipulation flex-col gap-1 overflow-hidden bg-card px-1 py-2 text-left focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                selected && 'bg-accent ring-2 ring-inset ring-primary')}
            >
              <span className={cn('text-center text-xs font-semibold', date === props.today && 'underline underline-offset-4')}>
                {Number(date.slice(-2))}
              </span>
              {!props.loading && entries.slice(0, CALENDAR_PREVIEW_LIMIT).map((entry, entryIndex) => (
                <span key={entryIndex} className="block w-full truncate rounded-sm bg-muted px-0.5 text-[11px] leading-4">{entry}</span>
              ))}
              {!props.loading && entries.length > CALENDAR_PREVIEW_LIMIT && (
                <span className="text-center text-[11px] text-muted-foreground">+{entries.length - CALENDAR_PREVIEW_LIMIT}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-xs text-muted-foreground">날짜를 누르면 상세 일정이 보여요.</p>
        <Button variant="ghost" className="shrink-0" onClick={props.onToday}>오늘</Button>
      </div>
    </section>
  );
}
