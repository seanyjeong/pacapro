'use client';

import { useRouter } from 'next/navigation';
import { InstructorAttendanceModal } from '@/components/schedules/instructor-attendance-modal';
import { TimeSlotDetailModal } from '@/components/schedules/time-slot-detail-modal';
import { ExtraDayRequestModal } from '@/components/schedules/extra-day-request-modal';
import { PendingApprovalsModal } from '@/components/schedules/pending-approvals-modal';
import { SchedulesHeader } from './schedules-page-header';
import { SchedulesLoading } from './schedules-page-loading';
import { SchedulesError } from './schedules-page-error';
import { SchedulesWorkspace } from './schedules-workspace';
import { useSchedulesPageState } from './use-schedules-page-state';

export function SchedulesPage() {
  const router = useRouter();
  const state = useSchedulesPageState();

  const handleDeleteSchedule = async (scheduleId: number, scheduleName: string) => {
    if (!confirm(`"${scheduleName}" 수업을 삭제하시겠습니까?`)) return;
    await state.deleteSchedule(scheduleId);
  };

  return (
    <div
      className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 py-4 md:max-w-7xl md:py-8"
      data-testid="schedules-workspace"
    >
      <SchedulesHeader
        canViewOvertimeApproval={state.canViewOvertimeApproval}
        pendingCount={state.pendingCount}
        selectedDate={state.selectedDate}
        onAddSchedule={() => router.push('/schedules/new')}
        onOpenApprovals={() => state.setApprovalsModalOpen(true)}
        onOpenInstructorAttendance={() => state.setInstructorAttendanceModalOpen(true)}
      />

      {state.schedulesLoading ? (
        <SchedulesLoading />
      ) : state.schedulesError ? (
        <SchedulesError message={state.schedulesError} onRetry={state.refreshScheduleSurface} />
      ) : (
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
    </div>
  );
}
