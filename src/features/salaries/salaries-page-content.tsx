'use client';

import { useRouter } from 'next/navigation';
import { PasswordConfirmModal } from '@/components/modals/password-confirm-modal';
import { SalaryList } from '@/components/salaries/salary-list';
import { SalariesError } from './salaries-error';
import { SalariesFilterBar } from './salaries-filter-bar';
import { SalariesHeader } from './salaries-header';
import { SalariesOperationsBoard } from './salaries-operations-board';
import { SalariesSummaryStrip } from './salaries-summary-strip';
import { useSalariesPageState } from './use-salaries-page-state';
import { formatWon } from './salaries-page-utils';

export function SalariesPageContent() {
  const router = useRouter();
  const state = useSalariesPageState();

  if (state.error && !state.loading) {
    return <SalariesError message={state.error} onRetry={state.reload} />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <SalariesHeader
        exporting={state.exporting}
        pdfExporting={state.pdfExporting}
        pdfProgress={state.pdfProgress}
        disableExport={state.salaries.length === 0}
        onExportExcel={state.exportExcel}
        onExportPDF={state.exportPDF}
        onReload={state.reload}
      />
      <SalariesSummaryStrip summary={state.summary} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <main className="order-2 min-w-0 space-y-5 xl:order-1">
          <SalariesFilterBar
            filters={state.filters}
            instructors={state.instructors}
            pendingCount={state.summary.pendingCount}
            bulkPaying={state.bulkPaying}
            onFilterChange={state.updateFilters}
            onPrevMonth={state.goToPrevMonth}
            onNextMonth={state.goToNextMonth}
            onDefaultMonth={state.goToDefaultMonth}
            onBulkPay={state.requestBulkPay}
          />
          <SalaryList salaries={state.salaries} loading={state.loading} onSalaryClick={(id) => router.push(`/salaries/${id}`)} />
        </main>
        <div className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2">
          <SalariesOperationsBoard
            bulkPaying={state.bulkPaying}
            exporting={state.exporting}
            filters={state.filters}
            instructors={state.instructors}
            loading={state.loading}
            pdfExporting={state.pdfExporting}
            pdfProgress={state.pdfProgress}
            summary={state.summary}
            onBulkPay={state.requestBulkPay}
            onDefaultMonth={state.goToDefaultMonth}
            onExportExcel={state.exportExcel}
            onExportPDF={state.exportPDF}
            onFilterChange={state.updateFilters}
            onReload={state.reload}
          />
        </div>
      </div>
      <PasswordConfirmModal
        open={state.showPasswordModal}
        onClose={() => state.setShowPasswordModal(false)}
        onConfirm={state.executeBulkPay}
        title="급여 지급 확인"
        description={`${state.summary.pendingCount}건의 급여를 모두 지급 처리합니다. (총 ${formatWon(state.summary.totalUnpaid)})\n비밀번호를 입력해주세요.`}
      />
    </div>
  );
}
