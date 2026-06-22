'use client';

import { Button } from '@/components/ui/button';
import { TabletAttendanceFilters } from './tablet-attendance-filters';
import { TabletAttendanceGrid } from './tablet-attendance-grid';
import { TabletAttendanceHeader } from './tablet-attendance-header';
import { TabletAttendanceReasonDialog } from './tablet-attendance-reason-dialog';
import { TabletAttendanceStats } from './tablet-attendance-stats';
import { useTabletAttendanceState } from './use-tablet-attendance-state';

export function TabletAttendancePage() {
  const state = useTabletAttendanceState();
  const hasStudents = state.students.length > 0;

  return (
    <div className="space-y-4 pb-20" data-testid="tablet-attendance-workspace">
      <TabletAttendanceHeader
        dateLabel={state.dateLabel}
        isToday={state.isToday}
        loading={state.loading}
        stats={state.stats}
        timeSlot={state.timeSlot}
        onNextDate={state.nextDate}
        onPreviousDate={state.previousDate}
        onRefresh={state.reload}
        onTimeSlotChange={state.setTimeSlot}
      />

      {!state.loading && !state.loadError && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <TabletAttendanceStats stats={state.stats} />
            <TabletAttendanceFilters filters={state.filters} onChange={state.setFilters} />
          </div>
          <aside className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">현재 표시</p>
            <p className="mt-2 font-mono text-4xl font-semibold text-zinc-950 dark:text-zinc-50">
              {state.filteredStudents.length}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">전체 {state.students.length}명 중 조건에 맞는 학생</p>
            <Button className="mt-4 h-12 w-full" onClick={state.markAllPresent} disabled={!hasStudents || state.savingId !== null}>
              전체 출석
            </Button>
          </aside>
        </div>
      )}

      <TabletAttendanceGrid
        error={state.loadError}
        loading={state.loading}
        savingId={state.savingId}
        students={state.filteredStudents}
        totalStudents={state.students.length}
        onChange={state.changeAttendance}
        onRetry={state.reload}
      />

      {state.savingId !== null && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-950">
          저장 중...
        </div>
      )}

      <TabletAttendanceReasonDialog
        reasonState={state.reasonState}
        onCancel={() => state.setReasonState(null)}
        onChange={state.setReasonState}
        onConfirm={state.confirmReason}
      />
    </div>
  );
}
