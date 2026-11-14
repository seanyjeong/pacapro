import { CalendarClock, CalendarDays, CalendarOff, Clock } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { AcademyEvent } from '@/lib/types/academyEvent';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/types/academyEvent';

interface AcademyEventsSummaryProps {
  canEditEvents: boolean;
  events: AcademyEvent[];
  onSelectEvent: (event: AcademyEvent) => void;
}

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatEventDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  const dayOfWeek = weekDays[new Date(year, month - 1, day).getDay()];
  return `${month}.${day}(${dayOfWeek})`;
}

export function AcademyEventsSummary({ canEditEvents, events, onSelectEvent }: AcademyEventsSummaryProps) {
  const today = formatLocalDate(new Date());
  const todayCount = events.filter((event) => event.event_date === today).length;
  const holidayCount = events.filter((event) => event.is_holiday || event.event_type === 'holiday').length;
  const upcomingEvent = [...events]
    .filter((event) => event.event_date >= today)
    .sort((a, b) => {
      const dateOrder = a.event_date.localeCompare(b.event_date);
      if (dateOrder !== 0) return dateOrder;
      return (a.start_time || '').localeCompare(b.start_time || '');
    })[0];

  return (
    <section
      aria-label="일정 숫자 요약"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      data-testid="academy-events-operations-board"
    >
      <div className="min-w-0" data-testid="academy-events-metric-month">
        <StatTile className="h-full" icon={CalendarDays} label="이번 달 일정" tone="primary" value={`${events.length}건`} />
      </div>
      <div className="min-w-0" data-testid="academy-events-metric-today">
        <StatTile className="h-full" icon={Clock} label="오늘 일정" tone="success" value={`${todayCount}건`} />
      </div>
      <div className="min-w-0" data-testid="academy-events-metric-holiday">
        <StatTile className="h-full" icon={CalendarOff} label="휴무 일정" tone="danger" value={`${holidayCount}건`} />
      </div>
      <div className="min-w-0">
        <StatTile
          className="flex h-full w-full flex-col"
          icon={CalendarClock}
          label="다음 일정"
          tone="warning"
          value={upcomingEvent ? formatEventDate(upcomingEvent.event_date) : '없음'}
          note={upcomingEvent ? <span className="block truncate">{upcomingEvent.title}</span> : '남은 일정이 없어요'}
          onClick={upcomingEvent && canEditEvents ? () => onSelectEvent(upcomingEvent) : undefined}
        />
      </div>
    </section>
  );
}

/** 달력 아래 범례. 종류별 색과 이번 달 건수. */
export function AcademyEventsLegend({ events }: { events: AcademyEvent[] }) {
  const eventsByType = events.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
      {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((type) => (
        <span
          key={type}
          className="inline-flex items-center gap-1.5"
          data-testid={type === 'work' ? 'academy-events-metric-work' : undefined}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS[type] }} />
          {EVENT_TYPE_LABELS[type]}
          <b className="font-semibold text-secondary-foreground tabular-nums">{eventsByType[type] || 0}</b>
        </span>
      ))}
    </div>
  );
}
