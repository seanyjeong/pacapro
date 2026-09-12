'use client';

import { useState } from 'react';
import { getInstructorCalendar } from '@/lib/api/instructor-calendar';
import { MobileCalendarShell } from '../mobile-calendar/mobile-calendar-shell';
import { MobileMonthCalendar } from '../mobile-calendar/mobile-month-calendar';
import { INSTRUCTOR_CALENDAR_SLOTS } from '../mobile-calendar/mobile-calendar-constants';
import { dateLabel } from '../mobile-calendar/mobile-calendar-utils';
import { useMobileMonth } from '../mobile-calendar/use-mobile-month';

export function MobileInstructorCalendarPage() {
  const state = useMobileMonth(getInstructorCalendar);
  const [instructorId, setInstructorId] = useState('all');
  const instructors = state.data?.instructors || [];
  const selectedId = instructors.some(instructor => String(instructor.id) === instructorId) ? instructorId : 'all';
  const schedules = (state.data?.schedules || []).filter(schedule => selectedId === 'all' || String(schedule.instructor_id) === selectedId);
  const entries: Record<string, string[]> = {};
  for (const schedule of schedules) {
    const label = selectedId === 'all' ? schedule.instructor_name
      : INSTRUCTOR_CALENDAR_SLOTS.find(slot => slot.key === schedule.time_slot)?.label || '';
    const dayEntries = entries[schedule.work_date] ||= [];
    if (!dayEntries.includes(label)) dayEntries.push(label);
  }
  const daySchedules = schedules.filter(schedule => schedule.work_date === state.selectedDate);
  const dayCount = new Set(schedules.map(schedule => schedule.work_date)).size;

  return (
    <MobileCalendarShell title="강사 근무달력" description="배정된 출근 예정일과 시간대를 확인하세요." loading={state.loading} error={state.error}
      errorMessage="강사 근무 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요." onRetry={state.reload}>
      <div className="flex items-center gap-3">
        <label htmlFor="calendar-instructor" className="shrink-0 text-sm font-medium">강사</label>
        <select id="calendar-instructor" value={selectedId} disabled={state.loading || state.error} onChange={event => setInstructorId(event.target.value)}
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <option value="all">전체 강사</option>
          {instructors.map(instructor => <option key={instructor.id} value={instructor.id}>{instructor.name}</option>)}
        </select>
      </div>
      <MobileMonthCalendar {...state} entries={entries} onDateSelect={state.setSelectedDate} />
      {!state.loading && !state.error && (
        <section aria-label="선택한 날짜의 강사 근무" className="space-y-3">
          <p className="text-xs text-muted-foreground">이번 달 {dayCount}일 · {schedules.length}개 시간대 배정</p>
          <h2 className="text-base font-semibold">{dateLabel(state.selectedDate)}</h2>
          {!schedules.length && <p className="text-sm text-muted-foreground">이번 달에 배정된 근무 일정이 없습니다.</p>}
          {schedules.length > 0 && !daySchedules.length && <p className="text-sm text-muted-foreground">이 날짜에는 배정된 근무가 없습니다.</p>}
          {INSTRUCTOR_CALENDAR_SLOTS.map(slot => {
            const slotSchedules = daySchedules.filter(schedule => schedule.time_slot === slot.key);
            if (!slotSchedules.length) return null;
            return (
              <div key={slot.key} className="border-t border-border pt-3">
                <h3 className="text-sm font-semibold">{slot.label} <span className="font-normal text-muted-foreground">{slotSchedules.length}명</span></h3>
                <ul className="divide-y divide-border">
                  {slotSchedules.map(schedule => (
                    <li key={schedule.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                      <span className="min-w-0 break-words font-medium">{schedule.instructor_name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {schedule.scheduled_start_time || schedule.scheduled_end_time
                          ? `${schedule.scheduled_start_time?.slice(0, 5) || '미정'} ~ ${schedule.scheduled_end_time?.slice(0, 5) || '미정'}` : '시간 미정'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </MobileCalendarShell>
  );
}
