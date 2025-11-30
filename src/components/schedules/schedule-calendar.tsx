'use client';

/**
 * 수업 캘린더 뷰 컴포넌트
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateCalendarGrid,
  isInMonth,
  formatDateToString,
  isToday,
  getTimeSlotColor,
  getTimeSlotLabel,
} from '@/lib/utils/schedule-helpers';
import type { ClassSchedule } from '@/lib/types/schedule';

interface ScheduleCalendarProps {
  schedules: ClassSchedule[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  onDateClick?: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

export function ScheduleCalendar({
  schedules,
  selectedDate,
  onDateSelect,
  onDateClick,
  onMonthChange,
}: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarGrid = generateCalendarGrid(year, month);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  // 날짜별 수업 그룹화
  const schedulesByDate = new Map<string, ClassSchedule[]>();
  schedules.forEach((schedule) => {
    const date = schedule.class_date;
    if (!schedulesByDate.has(date)) {
      schedulesByDate.set(date, []);
    }
    schedulesByDate.get(date)!.push(schedule);
  });

  const handlePrevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth());
  };

  const handleNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth());
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onMonthChange?.(today.getFullYear(), today.getMonth());
    onDateSelect(formatDateToString(today));
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
        <div className="grid grid-cols-7 gap-2">
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
            const daySchedules = schedulesByDate.get(dateStr) || [];
            const inMonth = isInMonth(date, year, month);
            const today = isToday(dateStr);
            const selected = dateStr === selectedDate;

            return (
              <button
                key={index}
                onClick={() => {
                  onDateSelect(dateStr);
                  // 현재 월의 날짜만 클릭 이벤트 발생
                  if (inMonth && onDateClick) {
                    onDateClick(dateStr);
                  }
                }}
                className={cn(
                  'min-h-[100px] p-2 rounded-lg border text-left transition-colors',
                  'hover:bg-accent hover:border-accent-foreground',
                  !inMonth && 'bg-muted/50 text-muted-foreground',
                  today && 'bg-primary/10 border-primary',
                  selected && 'bg-accent border-accent-foreground ring-2 ring-primary'
                )}
              >
                <div className="flex flex-col h-full">
                  <div
                    className={cn(
                      'text-sm font-medium mb-1',
                      index % 7 === 0 && 'text-red-600',
                      index % 7 === 6 && 'text-blue-600',
                      !inMonth && 'text-muted-foreground'
                    )}
                  >
                    {date.getDate()}
                  </div>

                  {/* 수업 표시 */}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {daySchedules.slice(0, 3).map((schedule) => (
                      <div
                        key={schedule.id}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded truncate border',
                          getTimeSlotColor(schedule.time_slot)
                        )}
                      >
                        {getTimeSlotLabel(schedule.time_slot)}
                        {schedule.attendance_taken && (
                          <span className="ml-1">✓</span>
                        )}
                      </div>
                    ))}
                    {daySchedules.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1.5">
                        +{daySchedules.length - 3}개
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200" />
              <span>오전</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
              <span>오후</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-100 border border-purple-200" />
              <span>저녁</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">✓</span>
              <span>출석 완료</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
