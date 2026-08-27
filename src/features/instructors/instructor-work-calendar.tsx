'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InstructorWorkSchedule } from '@/lib/api/schedules';
import {
  buildInstructorWorkCalendarDays,
  formatScheduleTime,
  groupInstructorSchedulesByDate,
} from './instructor-work-calendar-utils';
import { useInstructorWorkCalendar } from './use-instructor-work-calendar';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const SLOT_LABELS: Record<InstructorWorkSchedule['time_slot'], string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};
const SLOT_STYLES: Record<InstructorWorkSchedule['time_slot'], string> = {
  morning: 'border-amber-200 bg-amber-50 text-amber-800',
  afternoon: 'border-sky-200 bg-sky-50 text-sky-800',
  evening: 'border-violet-200 bg-violet-50 text-violet-800',
};

interface InstructorWorkCalendarProps {
  instructorId: number;
}

export function InstructorWorkCalendar({ instructorId }: InstructorWorkCalendarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const year = visibleMonth.getFullYear();
  const monthIndex = visibleMonth.getMonth();
  const { schedules, loading, error, retry } = useInstructorWorkCalendar(instructorId, year, monthIndex);
  const calendarDays = useMemo(() => buildInstructorWorkCalendarDays(year, monthIndex), [year, monthIndex]);
  const schedulesByDate = useMemo(() => groupInstructorSchedulesByDate(schedules), [schedules]);
  const scheduledDayCount = schedulesByDate.size;

  const changeMonth = (offset: number) => {
    setVisibleMonth(new Date(year, monthIndex + offset, 1));
  };

  const goToCurrentMonth = () => setVisibleMonth(new Date());

  return (
    <section className="w-[calc(100vw-2rem)] min-w-0 overflow-hidden rounded-md border border-border bg-card sm:w-full" data-testid="instructor-work-calendar">
      <div className="flex min-w-0 flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          aria-controls="instructor-work-calendar-content"
          aria-expanded={isExpanded}
          aria-label={`월별 출근 예정 ${isExpanded ? '접기' : '펼치기'}`}
          className="flex min-w-0 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">월별 출근 예정</h2>
              {!loading && !error && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  예정일 {scheduledDayCount}일
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">근무 일정에 배정된 날짜와 시간대입니다.</span>
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>

        {isExpanded && (
          <div className="flex items-center gap-1 self-end sm:self-auto">
            <Button aria-label="이전 달" size="icon" variant="outline" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button className="min-w-[112px]" size="sm" variant="outline" onClick={goToCurrentMonth}>
              {year}년 {monthIndex + 1}월
            </Button>
            <Button aria-label="다음 달" size="icon" variant="outline" onClick={() => changeMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div id="instructor-work-calendar-content" className="min-w-0 p-3 sm:p-4">
          {error ? (
            <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
              <p className="max-w-md text-sm text-muted-foreground">{error}</p>
              <Button className="gap-2" size="sm" variant="outline" onClick={() => void retry()}>
                <RotateCcw className="h-4 w-4" />
                다시 불러오기
              </Button>
            </div>
          ) : (
            <>
              {!loading && scheduledDayCount === 0 && (
                <p className="mb-3 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  이 달에는 등록된 출근 예정이 없습니다.
                </p>
              )}
              <div className="grid w-full min-w-0 grid-cols-7 border-l border-t border-border" role="grid" aria-label={`${year}년 ${monthIndex + 1}월 출근 예정 달력`}>
                {WEEKDAYS.map((weekday, index) => (
                  <div
                    key={weekday}
                    className={cn(
                      'min-w-0 border-b border-r border-border bg-muted/60 py-2 text-center text-xs font-medium text-muted-foreground',
                      index === 0 && 'text-red-600',
                      index === 6 && 'text-blue-600'
                    )}
                    role="columnheader"
                  >
                    {weekday}
                  </div>
                ))}
                {calendarDays.map((day, index) => {
                  const daySchedules = day.isCurrentMonth ? schedulesByDate.get(day.date) || [] : [];
                  const scheduleLabel = daySchedules.length > 0 ? ` 출근 예정 ${daySchedules.length}건` : '';
                  return (
                    <div
                      key={day.date}
                      aria-label={`${day.dayOfMonth}일${scheduleLabel}`}
                      className={cn(
                        'min-h-20 min-w-0 overflow-hidden border-b border-r border-border p-1 sm:min-h-28 sm:p-2',
                        !day.isCurrentMonth && 'bg-muted/25 text-muted-foreground/50',
                        day.isCurrentMonth && daySchedules.length > 0 && 'bg-primary/[0.035]',
                        day.isToday && 'ring-1 ring-inset ring-primary'
                      )}
                      role="gridcell"
                    >
                      <div className={cn(
                        'mb-1 text-xs font-medium',
                        index % 7 === 0 && day.isCurrentMonth && 'text-red-600',
                        index % 7 === 6 && day.isCurrentMonth && 'text-blue-600'
                      )}>
                        {day.dayOfMonth}
                        {day.isToday && <span className="ml-1 hidden text-[10px] text-primary sm:inline">오늘</span>}
                      </div>
                      <div className="space-y-1">
                        {loading && day.isCurrentMonth ? (
                          <div className="h-5 animate-pulse rounded bg-muted" />
                        ) : daySchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className={cn('min-w-0 overflow-hidden whitespace-nowrap rounded-md border px-0.5 py-0.5 text-center text-[10px] font-medium leading-tight sm:px-1.5 sm:text-left sm:text-xs', SLOT_STYLES[schedule.time_slot])}
                          >
                            <span className="sm:hidden">{SLOT_LABELS[schedule.time_slot]}</span>
                            <span className="hidden sm:inline">{formatScheduleLabel(schedule)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function formatScheduleLabel(schedule: InstructorWorkSchedule): string {
  const start = formatScheduleTime(schedule.scheduled_start_time);
  const end = formatScheduleTime(schedule.scheduled_end_time);
  const timeRange = start && end ? ` ${start}~${end}` : '';
  return `${SLOT_LABELS[schedule.time_slot]}${timeRange}`;
}
