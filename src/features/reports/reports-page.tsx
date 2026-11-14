'use client';

import { BranchChecks } from '@/features/branches/branch-checks';
import { useBranchTree } from '@/hooks/use-branches';
import { PeopleAnalysisPanel } from './people-analysis-panel';
import { ProfitAnalysisPanel } from './profit-analysis-panel';
import { ReportSummaryStrip } from './report-summary-strip';
import { ReportsErrorState } from './reports-error-state';
import { ReportsHeader } from './reports-header';
import { ReportsLoadingState } from './reports-loading-state';
import { ReportsOperationsBoard } from './reports-operations-board';
import { RevenueAnalysisPanel } from './revenue-analysis-panel';
import { canSeeProfit } from './reports-utils';
import { useReportsPageState } from './use-reports-page-state';

export function ReportsPage() {
  const state = useReportsPageState();
  const { branches } = useBranchTree();
  const hiddenLabels = [
    !state.access.payments && '학원비',
    !state.access.incomes && '기타 수입',
    !state.access.expenses && '지출',
    !state.access.instructors && '강사',
  ].filter((label): label is string => Boolean(label));

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

      <BranchChecks branches={branches} selected={state.branchIds} onChange={state.setBranchIds} />
      {state.branchIds.length > 0 && (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning" role="note">
          학생 수와 학원비 매출·미납만 체크한 지점 기준입니다. 지출·기타 수입·강사는 지점으로 나누지 않아 학원 전체 금액이고,
          순이익은 그 전체 지출을 뺀 값입니다.
        </p>
      )}
      {hiddenLabels.length > 0 && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground" role="note">
          권한에 맞춰 {hiddenLabels.join('·')} 정보는 숨겨져 있습니다.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="order-1 min-w-0 xl:col-start-1 xl:row-start-1">
          <ReportSummaryStrip access={state.access} computed={state.computed} stats={state.stats} />
        </div>

        <main className="order-3 min-w-0 space-y-5 xl:col-start-1 xl:row-start-2">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
            {state.access.payments && (
              <RevenueAnalysisPanel access={state.access} computed={state.computed} stats={state.stats} />
            )}
            <PeopleAnalysisPanel access={state.access} stats={state.stats} />
          </div>

          {canSeeProfit(state.access) && <ProfitAnalysisPanel computed={state.computed} stats={state.stats} />}
        </main>
        <div className="order-2 min-w-0 xl:sticky xl:top-20 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <ReportsOperationsBoard
            access={state.access}
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
