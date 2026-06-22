'use client';

import { MobileAttendanceHeader } from './mobile-attendance-header';
import { MobileAttendanceList } from './mobile-attendance-list';
import { MobileAttendanceReasonSheet } from './mobile-attendance-reason-sheet';
import { MobileAttendanceStats } from './mobile-attendance-stats';
import { useMobileAttendanceState } from './use-mobile-attendance-state';

export function MobileAttendancePage() {
  const state = useMobileAttendanceState();

  if (state.hasPermission === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50" data-testid="mobile-attendance-workspace">
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
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-950">
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
