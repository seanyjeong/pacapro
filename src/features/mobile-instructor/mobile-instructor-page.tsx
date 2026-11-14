'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileIconButton, MobileLoading, MobileScreen } from '../mobile-home/mobile-screen';
import { MobileInstructorHeader } from './mobile-instructor-header';
import { MobileInstructorList } from './mobile-instructor-list';
import { MobileInstructorSummary } from './mobile-instructor-summary';
import { useMobileInstructorState } from './use-mobile-instructor-state';

export function MobileInstructorPage() {
  const state = useMobileInstructorState();

  if (state.hasPermission === null) {
    return <MobileLoading />;
  }

  return (
    <MobileScreen
      testId="mobile-instructor-workspace"
      title="강사 출근체크"
      description={state.formattedDate}
      actions={(
        <MobileIconButton label="강사 출근 목록 새로고침" onClick={state.reload} disabled={state.loading}>
          <RefreshCw className={`h-5 w-5 ${state.loading ? 'animate-spin' : ''}`} />
        </MobileIconButton>
      )}
      footer={state.stats.total > 0 ? (
        <Button type="button" size="lg" className="w-full" onClick={state.save} disabled={state.saving || state.submitCount === 0}>
          {state.saving ? '저장 중...' : `저장 (${state.submitCount}건 반영)`}
        </Button>
      ) : undefined}
    >
      <MobileInstructorHeader date={state.date} onDateChange={state.setDate} />
      {!state.loading && !state.loadError && <MobileInstructorSummary stats={state.stats} />}
      <MobileInstructorList
        attendances={state.attendances}
        clearedKeys={state.clearedKeys}
        dateLabel={state.formattedDate}
        error={state.loadError}
        instructorsBySlot={state.instructorsBySlot}
        loading={state.loading}
        saving={state.saving}
        slots={state.slots}
        totalInstructors={state.stats.total}
        onAllPresent={state.markSlotPresent}
        onRetry={state.reload}
        onStatusChange={state.changeStatus}
      />
    </MobileScreen>
  );
}
