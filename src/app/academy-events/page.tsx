'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Calendar, CalendarDays, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { EventCalendar } from '@/components/academy-events/event-calendar';
import { EventFormModal } from '@/components/academy-events/event-form-modal';
import { getAcademyEvents, createAcademyEvent, updateAcademyEvent, deleteAcademyEvent } from '@/lib/api/academyEvents';
import type { AcademyEvent, AcademyEventFormData } from '@/lib/types/academyEvent';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/lib/types/academyEvent';
import { usePermissions } from '@/lib/utils/permissions';

const QUIET_REQUEST = { suppressErrorToast: true };
const LOAD_ERROR_MESSAGE = '학원 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
const SAVE_ERROR_MESSAGE = '학원 일정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.';
const DELETE_ERROR_MESSAGE = '학원 일정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.';

export default function AcademyEventsPage() {
    const [events, setEvents] = useState<AcademyEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<AcademyEvent | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [deleteConfirm, setDeleteConfirm] = useState<AcademyEvent | null>(null);
    const { canEdit } = usePermissions();
    const canEditEvents = canEdit('academy_events');

    const loadEvents = useCallback(async () => {
        try {
            setLoading(true);
            setLoadError(null);
            const [year, month] = selectedMonth.split('-');
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            const response = await getAcademyEvents({
                start_date: `${selectedMonth}-01`,
                end_date: `${selectedMonth}-${lastDay}`,
            }, QUIET_REQUEST);
            setEvents(response.events || []);
        } catch (err) {
            console.error('Failed to load events:', err);
            setEvents([]);
            setLoadError(LOAD_ERROR_MESSAGE);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const handleDateClick = (date: string) => {
        if (!canEditEvents) return;
        setSelectedDate(date);
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handleEventClick = (event: AcademyEvent) => {
        if (!canEditEvents) return;
        setSelectedEvent(event);
        setSelectedDate(event.event_date);
        setIsModalOpen(true);
    };

    const handleSubmit = async (data: AcademyEventFormData) => {
        try {
            if (selectedEvent) {
                await updateAcademyEvent(selectedEvent.id, data, QUIET_REQUEST);
                toast.success('일정이 수정되었습니다.');
            } else {
                await createAcademyEvent(data, QUIET_REQUEST);
                toast.success('일정이 등록되었습니다.');
            }
            loadEvents();
        } catch (err) {
            console.error('Failed to save academy event:', err);
            toast.error(SAVE_ERROR_MESSAGE);
            throw err;
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await deleteAcademyEvent(deleteConfirm.id, QUIET_REQUEST);
            toast.success('일정이 삭제되었습니다.');
            setDeleteConfirm(null);
            loadEvents();
        } catch (err) {
            console.error('Failed to delete academy event:', err);
            toast.error(DELETE_ERROR_MESSAGE);
        }
    };

    const eventsByType = events.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-7xl space-y-5 py-4 md:py-8">
                <header>
                    <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Academy Calendar</div>
                    <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">학원일정</h1>
                </header>
                <section className="flex min-h-[320px] items-center justify-center rounded-md border border-border bg-card p-6 text-center">
                    <div>
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-sm text-muted-foreground">일정을 불러오는 중...</p>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 py-4 md:py-8">
            <header className="flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Academy Calendar</div>
                    <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">학원일정</h1>
                    <p className="mt-1 text-sm text-muted-foreground">업무일정, 학원일정, 휴일 지정을 월 단위로 관리합니다.</p>
                </div>
                {canEditEvents && (
                    <Button className="gap-2" onClick={() => {
                        setSelectedEvent(null);
                        setSelectedDate(new Date().toISOString().split('T')[0]);
                        setIsModalOpen(true);
                    }}>
                        <Plus className="h-4 w-4" />
                        일정 등록
                    </Button>
                )}
            </header>

            {loadError ? (
                <section className="flex min-h-[320px] items-center justify-center rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
                    <div>
                        <AlertCircle className="mx-auto h-9 w-9" />
                        <h2 className="mt-4 text-base font-semibold">{LOAD_ERROR_MESSAGE}</h2>
                        <Button variant="outline" className="mt-5 gap-2" onClick={loadEvents}>
                            <RefreshCw className="h-4 w-4" />
                            다시 불러오기
                        </Button>
                    </div>
                </section>
            ) : null}

            {!loadError && (
            <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Card className="rounded-md">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">전체 일정</p>
                                <p className="text-2xl font-semibold tracking-normal text-foreground">{events.length}건</p>
                            </div>
                            <CalendarDays className="h-8 w-8 text-primary" />
                        </div>
                    </CardContent>
                </Card>

                {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((type) => (
                    <Card key={type} className="rounded-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{EVENT_TYPE_LABELS[type]}</p>
                                    <p className="text-2xl font-semibold tracking-normal" style={{ color: EVENT_TYPE_COLORS[type] }}>
                                        {eventsByType[type] || 0}건
                                    </p>
                                </div>
                                <div
                                    className="flex h-8 w-8 items-center justify-center rounded-md"
                                    style={{ backgroundColor: EVENT_TYPE_COLORS[type] + '20' }}
                                >
                                    <Calendar className="h-4 w-4" style={{ color: EVENT_TYPE_COLORS[type] }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <EventCalendar
                events={events}
                onDateClick={handleDateClick}
                onEventClick={handleEventClick}
                onEventDelete={(event) => setDeleteConfirm(event)}
                onMonthChange={setSelectedMonth}
                initialYearMonth={selectedMonth}
            />
            </>
            )}

            <EventFormModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedEvent(null);
                }}
                onSubmit={handleSubmit}
                event={selectedEvent}
                selectedDate={selectedDate}
            />

            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="mx-4 w-full max-w-sm rounded-md border border-border bg-background p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">일정 삭제</h3>
                                <p className="text-sm text-muted-foreground">정말 삭제하시겠습니까?</p>
                            </div>
                        </div>
                        <p className="text-sm text-foreground mb-1 font-medium">{deleteConfirm.title}</p>
                        <p className="text-sm text-muted-foreground mb-4">{deleteConfirm.event_date}</p>
                        {deleteConfirm.is_holiday && (
                            <p className="text-xs text-red-600 mb-4">
                                * 휴일 일정을 삭제하면 상담 차단과 수업 휴강이 해제됩니다.
                            </p>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                                취소
                            </Button>
                            <Button variant="destructive" onClick={handleDelete}>
                                삭제
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
