'use client';

import { BranchChecks } from '@/features/branches/branch-checks';
import { useBranchTree } from '@/hooks/use-branches';
import { cn } from '@/lib/utils/cn';
import { PeopleAnalysisPanel } from './people-analysis-panel';
import { ReportQuickLinks } from './report-quick-links';
import { ReportSummaryStrip } from './report-summary-strip';
import { ReportsErrorState } from './reports-error-state';
import { ReportsHeader } from './reports-header';
import { ReportsLoadingState } from './reports-loading-state';
import { RevenueAnalysisPanel } from './revenue-analysis-panel';
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
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-4 md:max-w-7xl">
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
        <p className="rounded-2xl bg-warning-soft px-4 py-3 text-[13px] font-medium text-warning" role="note">
          학생 수와 학원비 매출·미납만 체크한 지점 기준이에요. 지출·기타 수입·강사는 지점으로 나누지 않아 학원 전체 금액이고,
          순이익은 그 전체 지출을 뺀 값이에요.
        </p>
      )}
      {hiddenLabels.length > 0 && (
        <p className="rounded-2xl bg-muted px-4 py-3 text-[13px] font-medium text-muted-foreground" role="note">
          권한에 맞춰 {hiddenLabels.join('·')} 정보는 숨겨져 있어요.
        </p>
      )}

      <ReportSummaryStrip access={state.access} computed={state.computed} stats={state.stats} />

      <div className={cn('grid gap-4', state.access.payments && 'xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start')}>
        {state.access.payments && (
          <RevenueAnalysisPanel access={state.access} computed={state.computed} stats={state.stats} />
        )}
        <div className="min-w-0 space-y-4">
          <PeopleAnalysisPanel access={state.access} stats={state.stats} />
          <ReportQuickLinks access={state.access} stats={state.stats} />
        </div>
      </div>
    </div>
  );
}
