'use client';

import { Button } from '@/components/ui/button';
import { ClassRosterSelect } from '@/features/class-roster/class-roster-select';
import { useBranchTree } from '@/hooks/use-branches';
import { TabletAttendanceFilters } from './tablet-attendance-filters';
import { TabletAttendanceGrid } from './tablet-attendance-grid';
import { TabletAttendanceHeader } from './tablet-attendance-header';
import { TabletAttendanceReasonDialog } from './tablet-attendance-reason-dialog';
import { TabletAttendanceStats } from './tablet-attendance-stats';
import { useTabletAttendanceState } from './use-tablet-attendance-state';

export function TabletAttendancePage() {
  const state = useTabletAttendanceState();
  const { branches } = useBranchTree();
  const hasStudents = state.students.length > 0;

  return (
    <div className="space-y-4 pb-20" data-testid="tablet-attendance-workspace">
      <TabletAttendanceHeader
        dateLabel={state.dateLabel}
        isToday={state.isToday}
        loading={state.loading}
        timeSlot={state.timeSlot}
        onNextDate={state.nextDate}
        onPreviousDate={state.previousDate}
        onRefresh={state.reload}
        onTimeSlotChange={state.setTimeSlot}
        roster={(
          <ClassRosterSelect
            branches={branches}
            classId={state.classId}
            className="h-11 w-full min-w-0 rounded-xl border border-transparent bg-muted px-4 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
            onChange={state.setClassId}
          />
        )}
      />

      {!state.loading && !state.loadError && (
        <>
          <TabletAttendanceStats stats={state.stats} />
          <TabletAttendanceFilters
            filters={state.filters}
            onChange={state.setFilters}
            trailing={(
              <div className="flex shrink-0 items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  <span className="text-base font-extrabold text-foreground tabular-nums">{state.filteredStudents.length}</span>명 표시
                </p>
                <Button onClick={state.markAllPresent} disabled={!hasStudents || state.savingId !== null}>
                  전체 출석
                </Button>
              </div>
            )}
          />
        </>
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
        <div role="status" className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background">
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
