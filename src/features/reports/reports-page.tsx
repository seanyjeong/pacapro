'use client';

import { PeopleAnalysisPanel } from './people-analysis-panel';
import { ProfitAnalysisPanel } from './profit-analysis-panel';
import { ReportActionStrip } from './report-action-strip';
import { ReportSummaryStrip } from './report-summary-strip';
import { ReportsErrorState } from './reports-error-state';
import { ReportsHeader } from './reports-header';
import { ReportsLoadingState } from './reports-loading-state';
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

      <ReportSummaryStrip computed={state.computed} stats={state.stats} />
      <ReportActionStrip stats={state.stats} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <RevenueAnalysisPanel computed={state.computed} stats={state.stats} />
        <PeopleAnalysisPanel stats={state.stats} />
      </div>

      <ProfitAnalysisPanel computed={state.computed} stats={state.stats} />
    </div>
  );
}
