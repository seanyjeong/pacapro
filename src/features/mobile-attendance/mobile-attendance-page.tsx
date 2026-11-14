'use client';

import { ClassRosterSelect } from '@/features/class-roster/class-roster-select';
import { useBranchTree } from '@/hooks/use-branches';
import { MobileAttendanceHeader } from './mobile-attendance-header';
import { MobileAttendanceList } from './mobile-attendance-list';
import { MobileAttendanceReasonSheet } from './mobile-attendance-reason-sheet';
import { MobileAttendanceStats } from './mobile-attendance-stats';
import { useMobileAttendanceState } from './use-mobile-attendance-state';

export function MobileAttendancePage() {
  const state = useMobileAttendanceState();
  const { branches } = useBranchTree();

  if (state.hasPermission === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-sm text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted text-foreground" data-testid="mobile-attendance-workspace">
      <MobileAttendanceHeader
        date={state.date}
        formattedDate={state.formattedDate}
        loading={state.loading}
        stats={state.stats}
        timeSlot={state.timeSlot}
        onBack={() => state.router.push('/m')}
        onDateChange={state.setDate}
        onRefresh={state.reload}
        onTimeSlotChange={state.setTimeSlot}
      />

      <main className="mx-auto w-full max-w-md space-y-4 px-4 py-4 pb-28">
        <ClassRosterSelect
          branches={branches}
          classId={state.classId}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          onChange={state.setClassId}
        />
        {!state.loading && !state.loadError && <MobileAttendanceStats stats={state.stats} />}
        <MobileAttendanceList
          attendances={state.attendances}
          dateLabel={state.formattedDate}
          error={state.loadError}
          loading={state.loading}
          notes={state.attendanceNotes}
          saving={state.saving}
          scheduleId={state.scheduleId}
          students={state.students}
          timeSlot={state.timeSlot}
          onAllPresent={state.markAllPresent}
          onCall={state.callStudent}
          onRetry={state.reload}
          onStatusChange={state.changeStatus}
        />
      </main>

      {state.saving && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white shadow-lg">
          저장 중...
        </div>
      )}

      <MobileAttendanceReasonSheet
        reasonSheet={state.reasonSheet}
        onCancel={() => state.setReasonSheet(null)}
        onChange={state.setReasonSheet}
        onConfirm={state.confirmReason}
      />
    </div>
  );
}
