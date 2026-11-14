'use client';

/**
 * 수업 캘린더 뷰 v2
 * - 모든 날에 오전/오후/저녁 슬롯 표시
 * - 학생 드래그 앤 드롭으로 타임 이동
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, UserCheck, Sparkles, PhoneCall } from 'lucide-react';
import { toneIcon } from '@/components/ui/page';
import { TIME_SLOT_META } from '@/features/schedules/time-slot-meta';
import { cn } from '@/lib/utils';
import {
  generateCalendarGrid,
  isInMonth,
  formatDateToString,
  isToday,
} from '@/lib/utils/schedule-helpers';
import type { ClassSchedule, TimeSlot } from '@/lib/types/schedule';
import type { Consultation } from '@/lib/types/consultation';

interface SlotInstructorCounts {
  scheduled: number;
  attended: number;
}

interface DailyInstructorStats {
  morning: SlotInstructorCounts;
  afternoon: SlotInstructorCounts;
  evening: SlotInstructorCounts;
}

interface ScheduleCalendarV2Props {
  schedules: ClassSchedule[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
  onStudentMove?: (studentId: number, fromDate: string, fromSlot: TimeSlot, toDate: string, toSlot: TimeSlot) => void;
  onSlotClick?: (date: string, slot: TimeSlot) => void;
  instructorStats?: Record<string, DailyInstructorStats>;  // 날짜별 강사 통계
  consultations?: Record<string, Consultation[]>;  // 날짜별 상담 예약
  currentYear: number;   // 부모에서 관리하는 연도
  currentMonth: number;  // 부모에서 관리하는 월
  onConsultationClick?: (date: string) => void;  // 상담 클릭 시 상담 달력으로 이동
}

export function ScheduleCalendarV2({
  schedules,
  selectedDate,
  onDateSelect,
  onMonthChange,
  onStudentMove,
  onSlotClick,
  instructorStats,
  consultations,
  currentYear,
  currentMonth,
  onConsultationClick,
}: ScheduleCalendarV2Props) {
  const [draggedStudent, setDraggedStudent] = useState<{
    studentId: number;
    studentName: string;
    fromDate: string;
    fromSlot: TimeSlot;
  } | null>(null);

  // 부모에서 전달받은 연/월 사용 (제어 컴포넌트)
  const year = currentYear;
  const month = currentMonth;

  const calendarGrid = generateCalendarGrid(year, month);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  // 날짜+슬롯별 수업 및 학생 그룹화
  const scheduleMap = useMemo(() => {
    const map = new Map<string, ClassSchedule>();
    schedules.forEach((schedule) => {
      const key = `${schedule.class_date}_${schedule.time_slot}`;
      map.set(key, schedule);
    });
    return map;
  }, [schedules]);

  const handlePrevMonth = () => {
    // 부모에게만 알림 (부모가 상태 관리)
    const newDate = new Date(year, month - 1, 1);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth());
  };

  const handleNextMonth = () => {
    // 부모에게만 알림 (부모가 상태 관리)
    const newDate = new Date(year, month + 1, 1);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth());
  };

  const handleToday = () => {
    const today = new Date();
    onMonthChange?.(today.getFullYear(), today.getMonth());
    onDateSelect(formatDateToString(today));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, toDate: string, toSlot: TimeSlot) => {
    e.preventDefault();
    if (draggedStudent && onStudentMove) {
      const { studentId, fromDate, fromSlot } = draggedStudent;
      if (fromDate !== toDate || fromSlot !== toSlot) {
        onStudentMove(studentId, fromDate, fromSlot, toDate, toSlot);
      }
    }
    setDraggedStudent(null);
  };

  return (
    <section className="rounded-2xl bg-card px-2 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5" aria-label="수업 달력">
      <div className="mb-3 flex items-center justify-between gap-2 px-2 sm:px-0">
        <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-foreground">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          {year}년 {month + 1}월
        </h2>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={handleToday}>
            오늘
          </Button>
          <Button variant="outline" size="icon-sm" onClick={handlePrevMonth} aria-label="이전 달">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={handleNextMonth} aria-label="다음 달">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {/* 요일 헤더 */}
        {weekdays.map((day, index) => (
          <div
            key={day}
            className={cn(
              'py-1.5 text-center text-[13px] font-semibold text-muted-foreground',
              index === 0 && 'text-destructive',
              index === 6 && 'text-primary'
            )}
          >
            {day}
          </div>
        ))}

        {/* 캘린더 그리드 */}
        {calendarGrid.map((date, index) => {
          const dateStr = formatDateToString(date);
          const inMonth = isInMonth(date, year, month);
          const today = isToday(dateStr);
          const selected = dateStr === selectedDate;
          const consultationCount = inMonth ? consultations?.[dateStr]?.length || 0 : 0;

          return (
            <div
              key={index}
              onClick={() => onDateSelect(dateStr)}
              className={cn(
                'min-h-[96px] min-w-0 cursor-pointer overflow-hidden rounded-xl p-0.5 text-left transition-colors sm:min-h-[128px] sm:p-1.5',
                !inMonth && 'min-h-0 opacity-40 sm:min-h-0',
                selected ? 'bg-primary-soft ring-2 ring-inset ring-primary' : 'hover:bg-muted'
              )}
            >
              <div className="flex h-full flex-col">
                {/* 날짜 + 상담 */}
                <div className="mb-1 flex shrink-0 items-center justify-between gap-0.5 px-0.5">
                  <span
                    className={cn(
                      'flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
                      today && 'bg-primary text-primary-foreground',
                      !today && index % 7 === 0 && 'text-destructive',
                      !today && index % 7 === 6 && 'text-primary',
                      !today && index % 7 !== 0 && index % 7 !== 6 && 'text-foreground'
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {/* 상담 예약 표시 */}
                  {consultationCount > 0 && (
                    <span
                      className="flex h-5 shrink-0 cursor-pointer items-center gap-0.5 rounded-full bg-warning-soft px-1.5 text-[11px] font-bold text-warning tabular-nums transition-colors hover:bg-warning-soft/70"
                      title={`상담 ${consultationCount}건 - 클릭하여 상담 달력으로 이동`}
                      aria-label={`상담 ${consultationCount}건`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onConsultationClick?.(dateStr);
                      }}
                    >
                      <PhoneCall className="hidden h-3 w-3 shrink-0 sm:block" />
                      {consultationCount}
                    </span>
                  )}
                </div>

                {/* 타임 슬롯들 */}
                {inMonth && (
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {TIME_SLOT_META.map(({ slot, label, icon: Icon, tone }) => {
                      const key = `${dateStr}_${slot}`;
                      const schedule = scheduleMap.get(key);
                      const studentCount = schedule?.student_count || 0;
                      const trialCount = schedule?.trial_count || 0;

                      // 강사 통계
                      const dayStats = instructorStats?.[dateStr];
                      const slotStats = dayStats?.[slot];
                      const scheduledInstructors = slotStats?.scheduled || 0;
                      const attendedInstructors = slotStats?.attended || 0;

                      return (
                        <div
                          key={slot}
                          aria-label={label}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSlotClick?.(dateStr, slot);
                          }}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, dateStr, slot)}
                          className={cn(
                            'flex h-[22px] cursor-pointer items-center gap-0.5 overflow-hidden rounded-md px-1 text-[11px] font-semibold transition-opacity hover:opacity-80 sm:h-6 sm:gap-1 sm:px-1.5 sm:text-xs',
                            toneIcon[tone],
                            draggedStudent && 'ring-1 ring-dashed ring-muted-foreground'
                          )}
                        >
                          <Icon className="h-3 w-3 shrink-0" />
                          <span className="hidden shrink-0 sm:inline">{label}</span>
                          <div className="ml-auto flex shrink-0 items-center gap-1 overflow-hidden">
                            {/* 강사 출근/배정 현황 */}
                            {scheduledInstructors > 0 && (
                              <span
                                className={cn(
                                  'hidden shrink-0 items-center gap-0.5 rounded-full px-1 text-[10px] font-bold tabular-nums lg:flex',
                                  attendedInstructors >= scheduledInstructors
                                    ? 'bg-success text-success-foreground'
                                    : attendedInstructors > 0
                                    ? 'bg-warning text-warning-foreground'
                                    : 'bg-card text-muted-foreground'
                                )}
                                title={`출근 ${attendedInstructors}명 / 배정 ${scheduledInstructors}명`}
                              >
                                <UserCheck className="h-2.5 w-2.5 shrink-0" />
                                <span className="shrink-0">{attendedInstructors}/{scheduledInstructors}</span>
                              </span>
                            )}
                            {/* 체험생 태그 */}
                            {trialCount > 0 && (
                              <span className="hidden shrink-0 items-center gap-0.5 rounded-full bg-card px-1 text-[10px] font-bold text-primary tabular-nums lg:flex" title={`체험생 ${trialCount}명`}>
                                <Sparkles className="h-2.5 w-2.5 shrink-0" />
                                <span className="shrink-0">{trialCount}</span>
                              </span>
                            )}
                            {/* 학생 수 */}
                            {studentCount > 0 && (
                              <span className="flex shrink-0 items-center gap-0.5 text-foreground tabular-nums" title={`학생 ${studentCount}명`}>
                                <User className="hidden h-3 w-3 shrink-0 sm:block" />
                                <span className="shrink-0">{studentCount}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 px-2 pt-4 text-[13px] text-muted-foreground sm:px-0">
        {TIME_SLOT_META.map(({ slot, label, icon: Icon, tone }) => (
          <div key={slot} className="flex items-center gap-1.5">
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-md', toneIcon[tone])}>
              <Icon className="h-3 w-3" />
            </span>
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <User className="h-4 w-4" />
          <span>학생 수</span>
        </div>
        <div className="hidden items-center gap-1.5 lg:flex">
          <UserCheck className="h-4 w-4 text-success" />
          <span>강사 출근/배정</span>
        </div>
        <div className="hidden items-center gap-1.5 lg:flex">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>체험생</span>
        </div>
        <div className="flex items-center gap-1.5">
          <PhoneCall className="h-4 w-4 text-warning" />
          <span>상담 예약</span>
        </div>
      </div>
    </section>
  );
}
