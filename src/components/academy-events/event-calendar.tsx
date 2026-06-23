'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AcademyEvent } from '@/lib/types/academyEvent';

interface EventCalendarProps {
    canEditEvents?: boolean;
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

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

const formatEventDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const dayOfWeek = weekDays[new Date(year, month - 1, day).getDay()];
    return `${month}.${day}(${dayOfWeek})`;
};

const formatEventTime = (event: AcademyEvent) => {
    if (event.is_all_day) return '종일';
    const start = event.start_time?.slice(0, 5);
    const end = event.end_time?.slice(0, 5);
    if (start && end) return `${start}-${end}`;
    return start || end || '시간 미정';
};

export function EventCalendar({
    canEditEvents = true,
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

    const monthEvents = useMemo(() => {
        return [...events].sort((a, b) => {
            const dateOrder = a.event_date.localeCompare(b.event_date);
            if (dateOrder !== 0) return dateOrder;
            return (a.start_time || '').localeCompare(b.start_time || '');
        });
    }, [events]);

    // 로컬 시간 기준 오늘 날짜
    const todayStr = formatLocalDate(new Date());

    return (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrevMonth} aria-label="이전 달">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h2 className="text-lg font-semibold text-foreground min-w-[140px] text-center">
                        {year}년 {month + 1}월
                    </h2>
                    <Button variant="outline" size="sm" onClick={handleNextMonth} aria-label="다음 달">
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
                <Button variant="outline" size="sm" onClick={handleToday}>
                    오늘
                </Button>
            </div>

            <div className="border-b border-border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">이번 달 일정</h3>
                    <span className="text-xs text-muted-foreground">{monthEvents.length}건</span>
                </div>
                {monthEvents.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-sm text-muted-foreground">
                        등록된 일정이 없습니다. 날짜의 + 버튼이나 일정 등록으로 새 일정을 추가하세요.
                    </p>
                ) : (
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                        {monthEvents.map((event) => (
                            <div key={event.id} className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
                                <button
                                    type="button"
                                    disabled={!canEditEvents}
                                    onClick={() => onEventClick(event)}
                                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                                    aria-label={canEditEvents ? `${event.title} 수정` : `${event.title} 일정`}
                                >
                                    <span
                                        className="h-8 w-1.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: event.color }}
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-xs text-muted-foreground">
                                            {formatEventDate(event.event_date)} · {formatEventTime(event)}
                                        </span>
                                        <span className="block truncate text-sm font-medium text-foreground">{event.title}</span>
                                    </span>
                                </button>
                                {canEditEvents ? (
                                    <button
                                        type="button"
                                        onClick={() => onEventDelete(event)}
                                        className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                        aria-label={`${event.title} 삭제`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
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
                            className={`min-h-[100px] border-b border-r border-border p-1 transition-colors
                                ${canEditEvents ? 'cursor-pointer hover:bg-muted/50' : ''}
                                ${hasHoliday ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                            onClick={() => {
                                if (canEditEvents) onDateClick(dateStr);
                            }}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span
                                    className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                                        ${isToday ? 'bg-primary text-primary-foreground' : ''}
                                        ${dayOfWeek === 0 || hasHoliday ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-foreground'}`}
                                >
                                    {cell.date.getDate()}
                                </span>
                                {canEditEvents ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDateClick(dateStr);
                                        }}
                                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                                        aria-label={`${dateStr} 일정 등록`}
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                ) : null}
                            </div>
                            <div className="space-y-1">
                                {cell.events.slice(0, 3).map((event) => (
                                    <div
                                        key={event.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (canEditEvents) onEventClick(event);
                                        }}
                                        className={`group relative px-1.5 py-0.5 rounded text-xs font-medium truncate ${canEditEvents ? 'cursor-pointer' : ''}`}
                                        style={{ backgroundColor: event.color + '20', color: event.color }}
                                    >
                                        <span className="truncate">{event.title}</span>
                                        {canEditEvents ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEventDelete(event);
                                                }}
                                                className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900"
                                                aria-label={`${event.title} 삭제`}
                                            >
                                                <Trash2 className="w-3 h-3 text-red-500" />
                                            </button>
                                        ) : null}
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
