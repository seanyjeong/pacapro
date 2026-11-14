'use client';

import Link from 'next/link';
import { RefreshCw, Send } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { ClassRosterSelect } from '@/features/class-roster/class-roster-select';
import { useBranchTree } from '@/hooks/use-branches';
import { ATTENDANCE_TEST_NOTIFICATION_HREF } from '@/lib/constants/notification-links';
import { MOBILE_FIELD_CLASS, MobileIconButton, MobileLoading, MobileScreen } from '../mobile-home/mobile-screen';
import { MobileAttendanceHeader } from './mobile-attendance-header';
import { MobileAttendanceList } from './mobile-attendance-list';
import { MobileAttendanceReasonSheet } from './mobile-attendance-reason-sheet';
import { MobileAttendanceStats } from './mobile-attendance-stats';
import { useMobileAttendanceState } from './use-mobile-attendance-state';

export function MobileAttendancePage() {
  const state = useMobileAttendanceState();
  const { branches } = useBranchTree();

  if (state.hasPermission === null) {
    return <MobileLoading />;
  }

  return (
    <MobileScreen
      testId="mobile-attendance-workspace"
      title="학생 출석체크"
      description={state.formattedDate}
      bottomSpace
      actions={(
        <>
          <Link className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-11 gap-1.5 text-secondary-foreground' })} href={ATTENDANCE_TEST_NOTIFICATION_HREF}>
            <Send className="h-4 w-4" />
            출결 테스트발송
          </Link>
          <MobileIconButton label="출석 목록 새로고침" onClick={state.reload} disabled={state.loading}>
            <RefreshCw className={`h-5 w-5 ${state.loading ? 'animate-spin' : ''}`} />
          </MobileIconButton>
        </>
      )}
    >
      <MobileAttendanceHeader
        date={state.date}
        timeSlot={state.timeSlot}
        onDateChange={state.setDate}
        onTimeSlotChange={state.setTimeSlot}
        roster={(
          <ClassRosterSelect
            branches={branches}
            classId={state.classId}
            className={MOBILE_FIELD_CLASS}
            onChange={state.setClassId}
          />
        )}
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

      {state.saving && (
        <div role="status" className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
          저장 중...
        </div>
      )}

      <MobileAttendanceReasonSheet
        reasonSheet={state.reasonSheet}
        onCancel={() => state.setReasonSheet(null)}
        onChange={state.setReasonSheet}
        onConfirm={state.confirmReason}
      />
    </MobileScreen>
  );
}
