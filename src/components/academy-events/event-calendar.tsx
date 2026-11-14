'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AcademyEvent } from '@/lib/types/academyEvent';

interface EventCalendarProps {
    canEditEvents?: boolean;
    events: AcademyEvent[];
    onDateClick: (date: string) => void;
    onEventClick: (event: AcademyEvent) => void;
    onEventDelete: (event: AcademyEvent) => void;
    onMonthChange: (yearMonth: string) => void;
    initialYearMonth?: string;
    /** 달력 아래에 놓는 범례(종류별 건수). */
    legend?: React.ReactNode;
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
    legend,
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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <section className="min-w-0 rounded-2xl bg-card px-2 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5" aria-label="학원일정 달력">
                {/* 헤더 */}
                <div className="mb-3 flex items-center justify-between gap-2 px-2 sm:px-0">
                    <h2 className="text-[17px] font-bold tracking-tight text-foreground">
                        {year}년 {month + 1}월
                    </h2>
                    <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={handleToday}>
                            오늘
                        </Button>
                        <Button variant="outline" size="icon-sm" onClick={handlePrevMonth} aria-label="이전 달">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon-sm" onClick={handleNextMonth} aria-label="다음 달">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {weekDays.map((day, index) => (
                        <div
                            key={day}
                            className={cn(
                                'py-1.5 text-center text-[13px] font-semibold',
                                index === 0 ? 'text-destructive' : index === 6 ? 'text-primary' : 'text-muted-foreground'
                            )}
                        >
                            {day}
                        </div>
                    ))}

                    {/* 달력 그리드 */}
                    {calendarData.map((cell, index) => {
                        if (!cell.date) {
                            return <div key={index} className="min-h-[76px] sm:min-h-[104px]" />;
                        }

                        const dateStr = formatLocalDate(cell.date);
                        const dayOfWeek = cell.date.getDay();
                        const isToday = dateStr === todayStr;
                        const hasHoliday = cell.events.some(e => e.is_holiday);

                        return (
                            <div
                                key={index}
                                className={cn(
                                    'min-h-[76px] min-w-0 overflow-hidden rounded-xl p-0.5 transition-colors sm:min-h-[104px] sm:p-1.5',
                                    canEditEvents && 'cursor-pointer hover:bg-muted',
                                    hasHoliday && 'bg-destructive-soft hover:bg-destructive-soft'
                                )}
                                onClick={() => {
                                    if (canEditEvents) onDateClick(dateStr);
                                }}
                            >
                                <div className="mb-1 flex items-center justify-between px-0.5">
                                    <span
                                        className={cn(
                                            'flex h-6 min-w-6 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
                                            isToday
                                                ? 'bg-primary text-primary-foreground'
                                                : dayOfWeek === 0 || hasHoliday ? 'text-destructive' : dayOfWeek === 6 ? 'text-primary' : 'text-foreground'
                                        )}
                                    >
                                        {cell.date.getDate()}
                                    </span>
                                    {canEditEvents ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDateClick(dateStr);
                                            }}
                                            className="hidden h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground sm:flex"
                                            aria-label={`${dateStr} 일정 등록`}
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    ) : null}
                                </div>
                                <div className="space-y-0.5 sm:space-y-1">
                                    {cell.events.slice(0, 3).map((event, eventIndex) => (
                                        <div
                                            key={event.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (canEditEvents) onEventClick(event);
                                            }}
                                            className={cn(
                                                'group relative truncate rounded-md px-1 py-0.5 text-[11px] font-semibold leading-tight sm:px-1.5 sm:text-xs',
                                                eventIndex === 2 && 'hidden sm:block',
                                                canEditEvents && 'cursor-pointer'
                                            )}
                                            style={{ backgroundColor: event.color + '20', color: event.color }}
                                        >
                                            <span className="truncate">{event.title}</span>
                                            {canEditEvents ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEventDelete(event);
                                                    }}
                                                    className="absolute right-0.5 top-1/2 hidden -translate-y-1/2 rounded bg-card p-0.5 opacity-0 hover:bg-destructive-soft group-hover:opacity-100 sm:block"
                                                    aria-label={`${event.title} 삭제`}
                                                >
                                                    <Trash2 className="w-3 h-3 text-destructive" />
                                                </button>
                                            ) : null}
                                        </div>
                                    ))}
                                    {cell.events.length > 2 && (
                                        <div className={cn('px-1 text-[11px] font-semibold text-muted-foreground', cell.events.length <= 3 && 'sm:hidden')}>
                                            <span className="sm:hidden">+{cell.events.length - 2}</span>
                                            <span className="hidden sm:inline">+{cell.events.length - 3}개 더보기</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {legend ? <div className="mt-4 border-t border-border/60 px-2 pt-4 sm:px-0">{legend}</div> : null}
            </section>

            <section className="min-w-0 rounded-2xl bg-card px-5 pb-3 pt-5 sm:px-6" aria-label="이번 달 일정 목록">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[17px] font-bold tracking-tight text-foreground">이번 달 일정</h3>
                    <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">{monthEvents.length}건</span>
                </div>
                {monthEvents.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        등록된 일정이 없어요. 날짜의 + 버튼이나 일정 등록으로 새 일정을 추가해 주세요.
                    </p>
                ) : (
                    <div className="max-h-[560px] divide-y divide-border/60 overflow-y-auto">
                        {monthEvents.map((event) => (
                            <div key={event.id} className="flex items-center gap-2 py-2">
                                <button
                                    type="button"
                                    disabled={!canEditEvents}
                                    onClick={() => onEventClick(event)}
                                    className="-mx-1 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                                    aria-label={canEditEvents ? `${event.title} 수정` : `${event.title} 일정`}
                                >
                                    <span
                                        className="h-9 w-1.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: event.color }}
                                    />
                                    <span className="min-w-0">
                                        <span className="block truncate text-[15px] font-semibold text-foreground">{event.title}</span>
                                        <span className="block text-[13px] text-muted-foreground">
                                            {formatEventDate(event.event_date)} · {formatEventTime(event)}
                                        </span>
                                    </span>
                                </button>
                                {canEditEvents ? (
                                    <button
                                        type="button"
                                        onClick={() => onEventDelete(event)}
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                                        aria-label={`${event.title} 삭제`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
