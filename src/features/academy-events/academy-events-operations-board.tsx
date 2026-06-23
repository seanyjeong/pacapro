'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BriefcaseBusiness, CalendarDays, CalendarOff, CalendarPlus, Clock, Settings } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { AcademyEvent } from '@/lib/types/academyEvent';

interface AcademyEventsOperationsBoardProps {
  canEditEvents: boolean;
  events: AcademyEvent[];
  selectedMonth: string;
  onAddEvent: () => void;
  onSelectEvent: (event: AcademyEvent) => void;
}

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-');
  return `${year}년 ${Number(month)}월`;
}

function formatEventDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  const dayOfWeek = weekDays[new Date(year, month - 1, day).getDay()];
  return `${month}.${day}(${dayOfWeek})`;
}

function formatEventTime(event: AcademyEvent) {
  if (event.is_all_day) return '종일';
  const start = event.start_time?.slice(0, 5);
  const end = event.end_time?.slice(0, 5);
  if (start && end) return `${start}-${end}`;
  return start || end || '시간 미정';
}

export function AcademyEventsOperationsBoard({
  canEditEvents,
  events,
  selectedMonth,
  onAddEvent,
  onSelectEvent,
}: AcademyEventsOperationsBoardProps) {
  const today = formatLocalDate(new Date());
  const todayEvents = events.filter((event) => event.event_date === today);
  const holidayCount = events.filter((event) => event.is_holiday || event.event_type === 'holiday').length;
  const workCount = events.filter((event) => event.event_type === 'work').length;
  const upcomingEvent = [...events]
    .filter((event) => event.event_date >= today)
    .sort((a, b) => {
      const dateOrder = a.event_date.localeCompare(b.event_date);
      if (dateOrder !== 0) return dateOrder;
      return (a.start_time || '').localeCompare(b.start_time || '');
    })[0];

  return (
    <aside
      aria-label="일정 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="academy-events-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Academy Event Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">일정 작업 보드</h2>
        <p className="text-sm text-slate-600">{formatMonthLabel(selectedMonth)} 운영일과 휴무를 같이 확인합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={<CalendarDays className="h-4 w-4" />}
          label="이번 달 일정"
          testId="academy-events-metric-month"
          value={`${events.length}건`}
        />
        <Metric
          icon={<Clock className="h-4 w-4" />}
          label="오늘 일정"
          testId="academy-events-metric-today"
          value={`${todayEvents.length}건`}
        />
        <Metric
          icon={<CalendarOff className="h-4 w-4" />}
          label="휴무 일정"
          testId="academy-events-metric-holiday"
          value={`${holidayCount}건`}
        />
        <Metric
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          label="업무 일정"
          testId="academy-events-metric-work"
          value={`${workCount}건`}
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">다음 일정</p>
        {upcomingEvent ? (
          canEditEvents ? (
            <button
              aria-label={`${upcomingEvent.title} 일정 수정`}
              className="mt-2 block min-w-0 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              type="button"
              onClick={() => onSelectEvent(upcomingEvent)}
            >
              <UpcomingEventContent event={upcomingEvent} />
            </button>
          ) : (
            <div className="mt-2 min-w-0">
              <UpcomingEventContent event={upcomingEvent} />
            </div>
          )
        ) : (
          <p className="mt-2 text-sm text-slate-600">남은 일정이 없습니다.</p>
        )}
      </div>

      <div className="grid gap-2">
        <Button
          className="w-full justify-start gap-2"
          disabled={!canEditEvents}
          type="button"
          onClick={onAddEvent}
        >
          <CalendarPlus className="h-4 w-4" />
          새 일정 등록
        </Button>
        <Link
          className={buttonVariants({ variant: 'outline', className: 'w-full justify-start gap-2' })}
          href="/schedules"
        >
          <CalendarDays className="h-4 w-4" />
          수업 일정 확인
        </Link>
        <Link
          className={buttonVariants({ variant: 'ghost', className: 'w-full justify-start gap-2' })}
          href="/settings/consultation"
        >
          <Settings className="h-4 w-4" />
          상담 시간 설정
        </Link>
      </div>
    </aside>
  );
}

function UpcomingEventContent({ event }: { event: AcademyEvent }) {
  return (
    <>
      <p className="truncate text-sm font-semibold text-slate-950">{event.title}</p>
      <p className="mt-1 text-xs text-slate-600">
        {formatEventDate(event.event_date)} · {formatEventTime(event)}
      </p>
    </>
  );
}

interface MetricProps {
  icon: ReactNode;
  label: string;
  testId: string;
  value: string;
}

function Metric({ icon, label, testId, value }: MetricProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3" data-testid={testId}>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
