'use client';

import { getAcademyEvents } from '@/lib/api/academyEvents';
import type { APIRequestConfig } from '@/lib/api/client';
import { EVENT_TYPE_LABELS } from '@/lib/types/academyEvent';
import { MobileCalendarShell } from '../mobile-calendar/mobile-calendar-shell';
import { MobileMonthCalendar } from '../mobile-calendar/mobile-month-calendar';
import { dateLabel, monthDateRange } from '../mobile-calendar/mobile-calendar-utils';
import { useMobileMonth } from '../mobile-calendar/use-mobile-month';

function loadMonth(month: string, config: APIRequestConfig) {
  return getAcademyEvents(monthDateRange(month), config);
}

export function MobileAcademyEventsPage() {
  const state = useMobileMonth(loadMonth);
  const events = state.data?.events || [];
  const entries: Record<string, string[]> = {};
  for (const event of events) (entries[event.event_date] ||= []).push(event.title);
  const selectedEvents = events.filter(event => event.event_date === state.selectedDate);

  return (
    <MobileCalendarShell title="학원일정" description="행사와 휴일을 함께 확인하세요." loading={state.loading} error={state.error}
      errorMessage="학원 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요." onRetry={state.reload}>
      <MobileMonthCalendar {...state} entries={entries} onDateSelect={state.setSelectedDate} />
      {!state.loading && !state.error && (
        <section aria-label="선택한 날짜의 학원 일정" className="space-y-3">
          <h2 className="text-base font-semibold">{dateLabel(state.selectedDate)}</h2>
          {!events.length && <p className="text-sm text-muted-foreground">이번 달에 등록된 학원 일정이 없습니다.</p>}
          {events.length > 0 && !selectedEvents.length && <p className="text-sm text-muted-foreground">이 날짜에 등록된 일정이 없습니다.</p>}
          <ul className="divide-y divide-border">
            {selectedEvents.map(event => (
              <li key={event.id} className="space-y-2 py-3">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{EVENT_TYPE_LABELS[event.event_type]}</span>
                  <span>{event.is_all_day ? '종일' : [event.start_time?.slice(0, 5), event.end_time?.slice(0, 5)].filter(Boolean).join(' ~ ') || '시간 미정'}</span>
                  {event.is_holiday && <span>휴일</span>}
                </div>
                <h3 className="break-words text-sm font-semibold">{event.title}</h3>
                {event.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{event.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </MobileCalendarShell>
  );
}
