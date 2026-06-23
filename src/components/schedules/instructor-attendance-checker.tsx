'use client';

import { InstructorAttendanceListCard } from './instructor-attendance-list-card';
import { InstructorAttendanceSummaryCard } from './instructor-attendance-summary-card';
import {
  InstructorAttendanceErrorState,
  InstructorAttendanceLoadingState,
} from './instructor-attendance-states';
import { useInstructorAttendanceChecker } from './use-instructor-attendance-checker';

interface InstructorAttendanceCheckerProps {
  date: string;
  onSuccess?: () => void;
}

export function InstructorAttendanceChecker({ date, onSuccess }: InstructorAttendanceCheckerProps) {
  const state = useInstructorAttendanceChecker({ date, onSuccess });

  if (state.loading) {
    return <InstructorAttendanceLoadingState />;
  }

  if (state.loadError) {
    return (
      <InstructorAttendanceErrorState
        message={state.loadError}
        onRetry={state.loadData}
      />
    );
  }

  const dateObj = new Date(date);
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];

  return (
    <div className="space-y-6">
      <InstructorAttendanceSummaryCard
        date={date}
        dayOfWeek={dayOfWeek}
        selectedTimeSlot={state.selectedTimeSlot}
        slotCounts={state.slotCounts}
        stats={state.stats}
        onTimeSlotChange={state.handleTimeSlotChange}
      />

      <InstructorAttendanceListCard
        editedAttendances={state.editedAttendances}
        instructors={state.currentSlotInstructors}
        saveError={state.saveError}
        saving={state.saving}
        onMarkAllPresent={state.handleMarkAllPresent}
        onStatusChange={state.handleStatusChange}
        onSubmit={state.handleSubmit}
        onTimeChange={state.handleTimeChange}
      />
    </div>
  );
}
