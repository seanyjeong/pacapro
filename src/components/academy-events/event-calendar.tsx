'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AcademyEvent } from '@/lib/types/academyEvent';
import { EVENT_TYPE_LABELS } from '@/lib/types/academyEvent';

interface EventCalendarProps {
    events: AcademyEvent[];
    onDateClick: (date: string) => void;
    onEventClick: (event: AcademyEvent) => void;
    onEventDelete: (event: AcademyEvent) => void;
    onMonthChange: (yearMonth: string) => void;
    initialYearMonth?: string;
}

// 로컬 시간 기준 날짜 문자열 생성 (YYYY-MM-DD)
const formatLocalDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function EventCalendar({
    events,
    onDateClick,
    onEventClick,
    onEventDelete,
    onMonthChange,
    initialYearMonth,
}: EventCalendarProps) {
    const [currentDate, setCurrentDate] = useState(() => {
        if (initialYearMonth) {
            const [year, month] = initialYearMonth.split('-');
            return new Date(parseInt(year), parseInt(month) - 1, 1);
        }
        return new Date();
    });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // 달력 데이터 생성
    const calendarData = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days: { date: Date | null; events: AcademyEvent[] }[] = [];

        // 이전 달 빈 칸
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push({ date: null, events: [] });
        }

        // 이번 달
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = formatLocalDate(date);
            const dayEvents = events.filter(e => e.event_date === dateStr);
            days.push({ date, events: dayEvents });
        }

        return days;
    }, [year, month, events]);

    const handlePrevMonth = () => {
        const newDate = new Date(year, month - 1, 1);
        setCurrentDate(newDate);
        onMonthChange(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleNextMonth = () => {
        const newDate = new Date(year, month + 1, 1);
        setCurrentDate(newDate);
        onMonthChange(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleToday = () => {
        const today = new Date();
        setCurrentDate(today);
        onMonthChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    };

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    // 로컬 시간 기준 오늘 날짜
    const todayStr = formatLocalDate(new Date());

    return (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h2 className="text-lg font-semibold text-foreground min-w-[140px] text-center">
                        {year}년 {month + 1}월
                    </h2>
                    <Button variant="outline" size="sm" onClick={handleNextMonth}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
                <Button variant="outline" size="sm" onClick={handleToday}>
                    오늘
                </Button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-border">
                {weekDays.map((day, index) => (
                    <div
                        key={day}
                        className={`p-2 text-center text-sm font-medium
                            ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-muted-foreground'}`}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* 달력 그리드 */}
            <div className="grid grid-cols-7">
                {calendarData.map((cell, index) => {
                    if (!cell.date) {
                        return <div key={index} className="min-h-[100px] bg-muted/30 border-b border-r border-border" />;
                    }

                    const dateStr = formatLocalDate(cell.date);
                    const dayOfWeek = cell.date.getDay();
                    const isToday = dateStr === todayStr;
                    const hasHoliday = cell.events.some(e => e.is_holiday);

                    return (
                        <div
                            key={index}
                            className={`min-h-[100px] border-b border-r border-border p-1 cursor-pointer hover:bg-muted/50 transition-colors
                                ${hasHoliday ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                            onClick={() => onDateClick(dateStr)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span
                                    className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                                        ${isToday ? 'bg-primary text-primary-foreground' : ''}
                                        ${dayOfWeek === 0 || hasHoliday ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-foreground'}`}
                                >
                                    {cell.date.getDate()}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDateClick(dateStr);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="space-y-1">
                                {cell.events.slice(0, 3).map((event) => (
                                    <div
                                        key={event.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEventClick(event);
                                        }}
                                        className="group relative px-1.5 py-0.5 rounded text-xs font-medium truncate cursor-pointer"
                                        style={{ backgroundColor: event.color + '20', color: event.color }}
                                    >
                                        <span className="truncate">{event.title}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEventDelete(event);
                                            }}
                                            className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900"
                                        >
                                            <Trash2 className="w-3 h-3 text-red-500" />
                                        </button>
                                    </div>
                                ))}
                                {cell.events.length > 3 && (
                                    <div className="text-xs text-muted-foreground px-1.5">
                                        +{cell.events.length - 3}개 더보기
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
