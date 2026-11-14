'use client';

import { useState } from 'react';
import { getInstructorCalendar } from '@/lib/api/instructor-calendar';
import { MOBILE_FIELD_CLASS } from '../mobile-home/mobile-screen';
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
      <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
        <label htmlFor="calendar-instructor" className="shrink-0 text-[15px] font-semibold">강사</label>
        <select id="calendar-instructor" value={selectedId} disabled={state.loading || state.error} onChange={event => setInstructorId(event.target.value)}
          className={MOBILE_FIELD_CLASS}>
          <option value="all">전체 강사</option>
          {instructors.map(instructor => <option key={instructor.id} value={instructor.id}>{instructor.name}</option>)}
        </select>
      </div>
      <MobileMonthCalendar {...state} entries={entries} onDateSelect={state.setSelectedDate} />
      {!state.loading && !state.error && (
        <section aria-label="선택한 날짜의 강사 근무" className="rounded-2xl bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold">{dateLabel(state.selectedDate)}</h2>
            <p className="shrink-0 text-[13px] text-muted-foreground">이번 달 {dayCount}일 · {schedules.length}개 시간대 배정</p>
          </div>
          {!schedules.length && <p className="mt-2 text-sm text-muted-foreground">이번 달에 배정된 근무 일정이 없습니다.</p>}
          {schedules.length > 0 && !daySchedules.length && <p className="mt-2 text-sm text-muted-foreground">이 날짜에는 배정된 근무가 없습니다.</p>}
          {INSTRUCTOR_CALENDAR_SLOTS.map(slot => {
            const slotSchedules = daySchedules.filter(schedule => schedule.time_slot === slot.key);
            if (!slotSchedules.length) return null;
            return (
              <div key={slot.key} className="mt-4">
                <h3 className="text-[15px] font-bold text-foreground">{slot.label} <span className="font-medium text-muted-foreground">{slotSchedules.length}명</span></h3>
                <ul className="divide-y divide-border/60">
                  {slotSchedules.map(schedule => (
                    <li key={schedule.id} className="flex items-center justify-between gap-3 py-3 text-[15px]">
                      <span className="min-w-0 break-words font-semibold">{schedule.instructor_name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
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
