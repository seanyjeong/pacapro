'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstructorAttendanceModal } from '@/components/schedules/instructor-attendance-modal';
import { TimeSlotDetailModal } from '@/components/schedules/time-slot-detail-modal';
import { ExtraDayRequestModal } from '@/components/schedules/extra-day-request-modal';
import { PendingApprovalsModal } from '@/components/schedules/pending-approvals-modal';
import { ScheduleDeleteDialog } from './schedule-delete-dialog';
import { SchedulesHeader } from './schedules-page-header';
import { SchedulesLoading } from './schedules-page-loading';
import { SchedulesError } from './schedules-page-error';
import { SchedulesOperationsBoard } from './schedules-operations-board';
import { SchedulesWorkspace } from './schedules-workspace';
import { useSchedulesPageState } from './use-schedules-page-state';

type DeleteTarget = { scheduleId: number; scheduleName: string } | null;

export function SchedulesPage() {
  const router = useRouter();
  const state = useSchedulesPageState();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const handleDeleteSchedule = (scheduleId: number, scheduleName: string) => {
    setDeleteTarget({ scheduleId, scheduleName });
    setDeleteDialogOpen(true);
  };

  const openNewSchedule = () => {
    router.push(state.selectedDate ? `/schedules/new?date=${state.selectedDate}` : '/schedules/new');
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (deleteLoading) return;
    setDeleteDialogOpen(open);
  };

  const confirmDeleteSchedule = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);
      const deleted = await state.deleteSchedule(deleteTarget.scheduleId);
      if (deleted) setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div
      className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 py-4 md:max-w-[1680px] md:py-8"
      data-testid="schedules-workspace"
    >
      <SchedulesHeader
        canViewOvertimeApproval={state.canViewOvertimeApproval}
        pendingCount={state.pendingCount}
        selectedDate={state.selectedDate}
        onAddSchedule={openNewSchedule}
        onOpenApprovals={() => state.setApprovalsModalOpen(true)}
        onOpenInstructorAttendance={() => state.setInstructorAttendanceModalOpen(true)}
      />

      {state.schedulesLoading ? (
        <SchedulesLoading />
      ) : state.schedulesError ? (
        <SchedulesError message={state.schedulesError} onRetry={state.refreshScheduleSurface} />
      ) : (
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px] 2xl:items-start">
          <main className="order-1 min-w-0">
            <SchedulesWorkspace
              currentMonth={state.currentMonth}
              currentYear={state.currentYear}
              instructorStats={state.instructorStats}
              isPanelExpanded={state.isPanelExpanded}
              schedules={state.schedules}
              selectedDate={state.selectedDate}
              consultations={state.consultations}
              onConsultationClick={(date) => router.push(`/consultations/calendar?from=schedule&date=${date}`)}
              onDateSelect={state.setSelectedDate}
              onDeleteSchedule={handleDeleteSchedule}
              onEditSchedule={(scheduleId) => router.push(`/schedules/${scheduleId}/edit`)}
              onMonthChange={state.changeMonth}
              onOpenExtraDay={() => state.setExtraDayModalOpen(true)}
              onScheduleClick={(scheduleId) => router.push(`/schedules/${scheduleId}`)}
              onSlotClick={state.selectSlot}
              onTogglePanel={state.togglePanel}
              onPanelSave={state.loadInstructorStats}
            />
          </main>
          <div className="order-2 min-w-0 2xl:sticky 2xl:top-20">
            <SchedulesOperationsBoard
              canViewOvertimeApproval={state.canViewOvertimeApproval}
              consultations={state.consultations}
              pendingCount={state.pendingCount}
              schedules={state.schedules}
              selectedDate={state.selectedDate}
              onOpenApprovals={() => state.setApprovalsModalOpen(true)}
              onOpenExtraDay={() => state.setExtraDayModalOpen(true)}
              onOpenInstructorAttendance={() => state.setInstructorAttendanceModalOpen(true)}
            />
          </div>
        </div>
      )}

      <InstructorAttendanceModal
        open={state.instructorAttendanceModalOpen}
        date={state.selectedDate}
        onClose={() => {
          state.setInstructorAttendanceModalOpen(false);
          state.refreshScheduleSurface();
        }}
        onSuccess={state.refreshScheduleSurface}
      />

      <TimeSlotDetailModal
        open={state.slotModalOpen}
        date={state.selectedSlot?.date || null}
        timeSlot={state.selectedSlot?.slot || null}
        onClose={() => {
          state.setSlotModalOpen(false);
          state.setSelectedSlot(null);
        }}
        onStudentMoved={state.refreshScheduleSurface}
      />

      <ExtraDayRequestModal
        open={state.extraDayModalOpen}
        date={state.selectedDate}
        onClose={() => state.setExtraDayModalOpen(false)}
        onSuccess={state.refreshAfterApproval}
      />

      {state.canViewOvertimeApproval && (
        <PendingApprovalsModal
          open={state.approvalsModalOpen}
          onClose={() => state.setApprovalsModalOpen(false)}
          onApproved={state.refreshAfterApproval}
        />
      )}

      <ScheduleDeleteDialog
        loading={deleteLoading}
        open={deleteDialogOpen}
        scheduleName={deleteTarget?.scheduleName || '선택한'}
        onConfirm={() => void confirmDeleteSchedule()}
        onOpenChange={handleDeleteDialogOpenChange}
      />
    </div>
  );
}
