'use client';

import { CreditsError } from './credits-error';
import { CreditsFilterBar } from './credits-filter-bar';
import { CreditsHeader } from './credits-header';
import { CreditsLoading } from './credits-loading';
import { CreditsStudentsSection } from './credits-students-section';
import { CreditsSummaryStrip } from './credits-summary-strip';
import { CreditsTable } from './credits-table';
import { CreditsTypeStats } from './credits-type-stats';
import { useCreditsPageState } from './use-credits-page-state';

export function CreditsPageContent() {
  const state = useCreditsPageState();

  if (state.loading && state.credits.length === 0) {
    return <CreditsLoading />;
  }

  if (state.error && state.credits.length === 0) {
    return <CreditsError message={state.error} onRetry={state.reload} />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <CreditsHeader loading={state.loading} onReload={state.reload} />
      <CreditsSummaryStrip stats={state.stats} studentsWithCredit={state.studentsWithCredit} />
      <CreditsStudentsSection students={state.studentsWithCredit} />
      <CreditsFilterBar
        filters={state.filters}
        onStatusChange={state.setStatusFilter}
        onTypeChange={state.setTypeFilter}
      />
      <CreditsTable credits={state.credits} />
      <CreditsTypeStats typeStats={state.typeStats} />
    </div>
  );
}
