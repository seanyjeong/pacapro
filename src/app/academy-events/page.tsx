'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, CalendarDays, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { EventCalendar } from '@/components/academy-events/event-calendar';
import { EventFormModal } from '@/components/academy-events/event-form-modal';
import { getAcademyEvents, createAcademyEvent, updateAcademyEvent, deleteAcademyEvent } from '@/lib/api/academyEvents';
import type { AcademyEvent, AcademyEventFormData } from '@/lib/types/academyEvent';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/lib/types/academyEvent';
import { usePermissions } from '@/lib/utils/permissions';

export default function AcademyEventsPage() {
    const [events, setEvents] = useState<AcademyEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<AcademyEvent | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [deleteConfirm, setDeleteConfirm] = useState<AcademyEvent | null>(null);
    const { canEdit } = usePermissions();
    const canEditSchedules = canEdit('schedules');

    useEffect(() => {
        loadEvents();
    }, [selectedMonth]);

    const loadEvents = async () => {
        try {
            setLoading(true);
            const [year, month] = selectedMonth.split('-');
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            const response = await getAcademyEvents({
                start_date: `${selectedMonth}-01`,
                end_date: `${selectedMonth}-${lastDay}`,
            });
            setEvents(response.events || []);
        } catch (err) {
            console.error('Failed to load events:', err);
            toast.error('일정을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDateClick = (date: string) => {
        if (!canEditSchedules) return;
        setSelectedDate(date);
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handleEventClick = (event: AcademyEvent) => {
        if (!canEditSchedules) return;
        setSelectedEvent(event);
        setSelectedDate(event.event_date);
        setIsModalOpen(true);
    };

    const handleSubmit = async (data: AcademyEventFormData) => {
        try {
            if (selectedEvent) {
                await updateAcademyEvent(selectedEvent.id, data);
                toast.success('일정이 수정되었습니다.');
            } else {
                await createAcademyEvent(data);
                toast.success('일정이 등록되었습니다.');
            }
            loadEvents();
        } catch (err: any) {
            toast.error(err.response?.data?.message || '일정 처리에 실패했습니다.');
            throw err;
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await deleteAcademyEvent(deleteConfirm.id);
            toast.success('일정이 삭제되었습니다.');
            setDeleteConfirm(null);
            loadEvents();
        } catch (err: any) {
            toast.error(err.response?.data?.message || '일정 삭제에 실패했습니다.');
        }
    };

    const holidayCount = events.filter(e => e.is_holiday).length;
    const eventsByType = events.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    if (loading) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-foreground">학원일정</h1>
                <Card>
                    <CardContent className="p-12 text-center">
                        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">일정을 불러오는 중...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">학원일정</h1>
                    <p className="text-muted-foreground mt-1">업무일정 및 학원일정 관리</p>
                </div>
                {canEditSchedules && (
                    <Button onClick={() => {
                        setSelectedEvent(null);
                        setSelectedDate(new Date().toISOString().split('T')[0]);
                        setIsModalOpen(true);
                    }}>
                        <Plus className="w-4 h-4 mr-2" />
                        일정 등록
                    </Button>
                )}
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">전체 일정</p>
                                <p className="text-2xl font-bold text-foreground">{events.length}건</p>
                            </div>
                            <CalendarDays className="w-8 h-8 text-primary" />
                        </div>
                    </CardContent>
                </Card>

                {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((type) => (
                    <Card key={type}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{EVENT_TYPE_LABELS[type]}</p>
                                    <p className="text-2xl font-bold" style={{ color: EVENT_TYPE_COLORS[type] }}>
                                        {eventsByType[type] || 0}건
                                    </p>
                                </div>
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: EVENT_TYPE_COLORS[type] + '20' }}
                                >
                                    <Calendar className="w-4 h-4" style={{ color: EVENT_TYPE_COLORS[type] }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* 달력 */}
            <EventCalendar
                events={events}
                onDateClick={handleDateClick}
                onEventClick={handleEventClick}
                onEventDelete={(event) => setDeleteConfirm(event)}
                onMonthChange={setSelectedMonth}
                initialYearMonth={selectedMonth}
            />

            {/* 모달 */}
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

            {/* 삭제 확인 다이얼로그 */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
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
