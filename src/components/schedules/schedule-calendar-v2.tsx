'use client';

/**
 * 수업 캘린더 뷰 v2
 * - 모든 날에 오전/오후/저녁 슬롯 표시
 * - 학생 드래그 앤 드롭으로 타임 이동
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sun, Sunrise, Moon, User, UserCheck, Sparkles, PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateCalendarGrid,
  isInMonth,
  formatDateToString,
  isToday,
} from '@/lib/utils/schedule-helpers';
import type { ClassSchedule, TimeSlot } from '@/lib/types/schedule';
import type { Consultation } from '@/lib/types/consultation';

interface StudentInSlot {
  id: number;
  name: string;
  student_id: number;
}

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

const TIME_SLOTS: { slot: TimeSlot; label: string; icon: typeof Sun; color: string; bgColor: string }[] = [
  { slot: 'morning', label: '오전', icon: Sunrise, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950 hover:bg-orange-100 dark:hover:bg-orange-900 border-orange-200 dark:border-orange-800 hover:shadow-sm' },
  { slot: 'afternoon', label: '오후', icon: Sun, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800 hover:shadow-sm' },
  { slot: 'evening', label: '저녁', icon: Moon, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 border-purple-200 dark:border-purple-800 hover:shadow-sm' },
];

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

  const handleDragStart = (
    e: React.DragEvent,
    studentId: number,
    studentName: string,
    fromDate: string,
    fromSlot: TimeSlot
  ) => {
    setDraggedStudent({ studentId, studentName, fromDate, fromSlot });
    e.dataTransfer.effectAllowed = 'move';
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

  const handleDragEnd = () => {
    setDraggedStudent(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {year}년 {month + 1}월
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              오늘
            </Button>
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {/* 요일 헤더 */}
          {weekdays.map((day, index) => (
            <div
              key={day}
              className={cn(
                'text-center text-sm font-semibold py-2',
                index === 0 && 'text-red-600',
                index === 6 && 'text-blue-600'
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

            return (
              <div
                key={index}
                onClick={() => onDateSelect(dateStr)}
                className={cn(
                  'min-h-[140px] p-1 rounded-lg border text-left transition-all duration-200 cursor-pointer overflow-hidden',
                  !inMonth && 'bg-muted/50 opacity-50',
                  today && 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary border-2 shadow-sm',
                  selected && !today && 'bg-primary/5 ring-2 ring-primary shadow-md',
                  selected && today && 'ring-2 ring-primary shadow-md',
                  !selected && !today && 'hover:shadow-sm hover:border-primary/30'
                )}
              >
                <div className="flex flex-col h-full">
                  {/* 날짜 + 상담 */}
                  <div className="flex items-center justify-between mb-1 px-1 shrink-0">
                    <span
                      className={cn(
                        'text-sm font-semibold shrink-0',
                        today && 'text-primary',
                        !today && index % 7 === 0 && 'text-red-600',
                        !today && index % 7 === 6 && 'text-blue-600',
                        !inMonth && 'text-muted-foreground'
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {/* 상담 예약 표시 */}
                    {inMonth && consultations?.[dateStr] && consultations[dateStr].length > 0 && (
                      <span
                        className="flex items-center gap-0.5 text-xs text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950 px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-pink-100 dark:hover:bg-pink-900 transition-all hover:shadow-sm shrink-0"
                        title={`상담 ${consultations[dateStr].length}건 - 클릭하여 상담 달력으로 이동`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onConsultationClick?.(dateStr);
                        }}
                      >
                        <PhoneCall className="h-3 w-3 shrink-0" />
                        <span className="shrink-0">{consultations[dateStr].length}</span>
                      </span>
                    )}
                  </div>

                  {/* 타임 슬롯들 */}
                  {inMonth && (
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {TIME_SLOTS.map(({ slot, label, icon: Icon, color, bgColor }) => {
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
                            onClick={(e) => {
                              e.stopPropagation();
                              onSlotClick?.(dateStr, slot);
                            }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, dateStr, slot)}
                            className={cn(
                              'flex items-center gap-1 px-1 py-0.5 rounded text-xs border transition-all cursor-pointer overflow-hidden',
                              bgColor,
                              draggedStudent && 'ring-1 ring-dashed ring-muted-foreground'
                            )}
                          >
                            <Icon className={cn('h-3 w-3 shrink-0', color)} />
                            <span className={cn('font-medium shrink-0', color)}>{label}</span>
                            <div className="ml-auto flex items-center gap-1 shrink-0 overflow-hidden">
                              {/* 강사 출근/배정 현황 */}
                              {scheduledInstructors > 0 && (
                                <span
                                  className={cn(
                                    'flex items-center gap-0.5 shrink-0 px-1 py-0.5 rounded-full text-[10px] font-semibold',
                                    attendedInstructors >= scheduledInstructors
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                      : attendedInstructors > 0
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                      : 'bg-muted text-muted-foreground'
                                  )}
                                  title={`출근 ${attendedInstructors}명 / 배정 ${scheduledInstructors}명`}
                                >
                                  <UserCheck className="h-2.5 w-2.5 shrink-0" />
                                  <span className="shrink-0">{attendedInstructors}/{scheduledInstructors}</span>
                                </span>
                              )}
                              {/* 체험생 태그 */}
                              {trialCount > 0 && (
                                <span className="flex items-center gap-0.5 shrink-0 px-1 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400" title={`체험생 ${trialCount}명`}>
                                  <Sparkles className="h-2.5 w-2.5 shrink-0" />
                                  <span className="shrink-0">{trialCount}</span>
                                </span>
                              )}
                              {/* 학생 수 */}
                              {studentCount > 0 && (
                                <span className="flex items-center gap-0.5 shrink-0 text-muted-foreground">
                                  <User className="h-3 w-3 shrink-0" />
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
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-4 text-sm">
            {TIME_SLOTS.map(({ slot, label, icon: Icon, color }) => (
              <div key={slot} className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', color)} />
                <span>{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 ml-4 border-l pl-4">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span>= 강사 출근/배정</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>= 체험생</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>= 학생 수</span>
            </div>
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-pink-600" />
              <span>= 상담 예약</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
