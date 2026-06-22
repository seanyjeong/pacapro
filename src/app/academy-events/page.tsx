'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EventCalendar } from '@/components/academy-events/event-calendar';
import { EventFormModal } from '@/components/academy-events/event-form-modal';
import { AcademyEventDeleteDialog } from '@/features/academy-events/academy-event-delete-dialog';
import { AcademyEventsHeader } from '@/features/academy-events/academy-events-header';
import { AcademyEventsError, AcademyEventsLoading } from '@/features/academy-events/academy-events-states';
import { AcademyEventsSummary } from '@/features/academy-events/academy-events-summary';
import { getAcademyEvents, createAcademyEvent, updateAcademyEvent, deleteAcademyEvent } from '@/lib/api/academyEvents';
import type { AcademyEvent, AcademyEventFormData } from '@/lib/types/academyEvent';
import { formatDate } from '@/lib/utils/format';
import { usePermissions } from '@/lib/utils/permissions';

const QUIET_REQUEST = { suppressErrorToast: true };
const LOAD_ERROR_MESSAGE = '학원 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
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
        } catch {
            setEvents([]);
            setLoadError(LOAD_ERROR_MESSAGE);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const openCreateModal = () => {
        setSelectedEvent(null);
        setSelectedDate(formatDate(new Date()));
        setIsModalOpen(true);
    };

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
        if (selectedEvent) {
            await updateAcademyEvent(selectedEvent.id, data, QUIET_REQUEST);
            toast.success('일정이 수정되었습니다.');
        } else {
            await createAcademyEvent(data, QUIET_REQUEST);
            toast.success('일정이 등록되었습니다.');
        }
        loadEvents();
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await deleteAcademyEvent(deleteConfirm.id, QUIET_REQUEST);
            toast.success('일정이 삭제되었습니다.');
            setDeleteConfirm(null);
            loadEvents();
        } catch {
            toast.error(DELETE_ERROR_MESSAGE);
        }
    };

    if (loading) {
        return <AcademyEventsLoading />;
    }

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 py-4 md:py-8">
            <AcademyEventsHeader canEditEvents={canEditEvents} onAddEvent={openCreateModal} />

            {loadError ? (
                <AcademyEventsError message={loadError} onRetry={loadEvents} />
            ) : null}

            {!loadError && (
                <>
                    <AcademyEventsSummary events={events} />

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
                <AcademyEventDeleteDialog
                    event={deleteConfirm}
                    onCancel={() => setDeleteConfirm(null)}
                    onConfirm={handleDelete}
                />
            )}
        </div>
    );
}
