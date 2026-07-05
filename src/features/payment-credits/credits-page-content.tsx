'use client';

import { CreditsError } from './credits-error';
import { CreditsFilterBar } from './credits-filter-bar';
import { CreditsHeader } from './credits-header';
import { CreditsLoading } from './credits-loading';
import { CreditsOperationsBoard } from './credits-operations-board';
import { CreditsSummaryStrip } from './credits-summary-strip';
import { CreditsTable } from './credits-table';
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <main className="order-2 min-w-0 space-y-5 xl:order-1">
          <CreditsFilterBar
            filters={state.filters}
            onStatusChange={state.setStatusFilter}
            onTypeChange={state.setTypeFilter}
          />
          <CreditsTable credits={state.credits} />
        </main>
        <div className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2">
          <CreditsOperationsBoard
            filters={state.filters}
            loading={state.loading}
            stats={state.stats}
            students={state.studentsWithCredit}
            typeStats={state.typeStats}
            onReload={state.reload}
            onResetFilters={state.resetFilters}
            onStatusChange={state.setStatusFilter}
            onTypeChange={state.setTypeFilter}
          />
        </div>
      </div>
    </div>
  );
}
