'use client';

import { useParams, useRouter } from 'next/navigation';
import { SeasonEnrollContextPanel } from './season-enroll-context-panel';
import { SeasonEnrollError } from './season-enroll-error';
import { SeasonEnrollHeader } from './season-enroll-header';
import { SeasonEnrollLoading } from './season-enroll-loading';
import { SeasonEnrollStudentPanel } from './season-enroll-student-panel';
import { SeasonEnrollSummaryStrip } from './season-enroll-summary-strip';
import { SeasonEnrollTimeSlotDialog } from './season-enroll-time-slot-dialog';
import { parseSeasonId } from './season-enroll-utils';
import { useSeasonEnrollState } from './use-season-enroll-state';

export function SeasonEnrollPage() {
  const router = useRouter();
  const params = useParams();
  const seasonId = parseSeasonId(params.id);
  const state = useSeasonEnrollState(seasonId);

  if (state.loading) {
    return <SeasonEnrollLoading />;
  }

  if (state.error || !state.season || !seasonId) {
    return <SeasonEnrollError message={state.error} onBack={() => router.push('/seasons')} onRetry={state.reload} />;
  }

  return (
    <div
      className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl"
      data-testid="season-enroll-workspace"
    >
      <SeasonEnrollHeader season={state.season} onBack={() => router.push(`/seasons/${seasonId}`)} />

      <SeasonEnrollSummaryStrip
        availableCount={state.availableStudents.length}
        enrolledCount={state.enrolledStudents.length}
        season={state.season}
        totalEligibleCount={state.totalEligibleCount}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SeasonEnrollStudentPanel
          availableStudents={state.availableStudents}
          enrolledStudents={state.enrolledStudents}
          enrollingId={state.enrollingId}
          searchTerm={state.searchTerm}
          onEnrollClick={state.beginEnrollment}
          onSearchChange={state.setSearchTerm}
        />
        <SeasonEnrollContextPanel season={state.season} />
      </div>

      <SeasonEnrollTimeSlotDialog
        discountAmount={state.discountAmount}
        enrolling={state.enrollingId === state.selectedStudent?.id}
        season={state.season}
        selectedStudent={state.selectedStudent}
        selectedTimeSlots={state.selectedTimeSlots}
        onClose={state.closeDialog}
        onConfirm={state.confirmEnrollment}
        onDiscountChange={state.setDiscountAmount}
        onTimeSlotToggle={state.changeTimeSlot}
      />
    </div>
  );
}
