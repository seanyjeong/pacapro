'use client';

import { PeopleAnalysisPanel } from './people-analysis-panel';
import { ProfitAnalysisPanel } from './profit-analysis-panel';
import { ReportSummaryStrip } from './report-summary-strip';
import { ReportsErrorState } from './reports-error-state';
import { ReportsHeader } from './reports-header';
import { ReportsLoadingState } from './reports-loading-state';
import { ReportsOperationsBoard } from './reports-operations-board';
import { RevenueAnalysisPanel } from './revenue-analysis-panel';
import { useReportsPageState } from './use-reports-page-state';

export function ReportsPage() {
  const state = useReportsPageState();

  if (state.loading) {
    return <ReportsLoadingState selectedMonth={state.selectedMonth} />;
  }

  if (state.error) {
    return (
      <ReportsErrorState
        message={state.error}
        selectedMonth={state.selectedMonth}
        onMonthChange={state.setSelectedMonth}
        onRetry={state.reload}
      />
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <ReportsHeader
        exportMenuOpen={state.exportMenuOpen}
        exportingType={state.exportingType}
        selectedMonth={state.selectedMonth}
        onExport={state.exportReport}
        onExportMenuChange={state.setExportMenuOpen}
        onMonthChange={state.setSelectedMonth}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="order-1 min-w-0 xl:col-start-1 xl:row-start-1">
          <ReportSummaryStrip computed={state.computed} stats={state.stats} />
        </div>

        <main className="order-3 min-w-0 space-y-5 xl:col-start-1 xl:row-start-2">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
            <RevenueAnalysisPanel computed={state.computed} stats={state.stats} />
            <PeopleAnalysisPanel stats={state.stats} />
          </div>

          <ProfitAnalysisPanel computed={state.computed} stats={state.stats} />
        </main>
        <div className="order-2 min-w-0 xl:sticky xl:top-20 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <ReportsOperationsBoard
            computed={state.computed}
            exportingType={state.exportingType}
            selectedMonth={state.selectedMonth}
            stats={state.stats}
            onExport={state.exportReport}
            onMonthChange={state.setSelectedMonth}
          />
        </div>
      </div>
    </div>
  );
}
