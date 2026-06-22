'use client';

import { Button } from '@/components/ui/button';
import { MobileInstructorHeader } from './mobile-instructor-header';
import { MobileInstructorList } from './mobile-instructor-list';
import { MobileInstructorSummary } from './mobile-instructor-summary';
import { useMobileInstructorState } from './use-mobile-instructor-state';

export function MobileInstructorPage() {
  const state = useMobileInstructorState();

  if (state.hasPermission === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50" data-testid="mobile-instructor-workspace">
      <MobileInstructorHeader
        date={state.date}
        formattedDate={state.formattedDate}
        loading={state.loading}
        stats={state.stats}
        onBack={() => state.router.push('/m')}
        onDateChange={state.setDate}
        onRefresh={state.reload}
      />

      <main className="mx-auto w-full max-w-md space-y-4 px-4 py-4 pb-28">
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
      </main>

      {state.stats.total > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <Button type="button" className="h-12 w-full" onClick={state.save} disabled={state.saving || state.submitCount === 0}>
            {state.saving ? '저장 중...' : `저장 (${state.submitCount}건 반영)`}
          </Button>
        </div>
      )}
    </div>
  );
}
