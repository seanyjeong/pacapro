'use client';

import { useState } from 'react';
import { IncomeCalendar } from '@/components/incomes/income-calendar';
import { usePermissions } from '@/lib/utils/permissions';
import { IncomeDeleteDialog } from './income-delete-dialog';
import { IncomeLoadingState } from './income-loading-state';
import { IncomeSummaryStrip } from './income-summary-strip';
import { IncomeTabs } from './income-tabs';
import { IncomesError } from './incomes-error';
import { IncomesEmptyState } from './incomes-empty-state';
import { IncomesHeader } from './incomes-header';
import { OtherIncomeDetailDialog } from './other-income-detail-dialog';
import { OtherIncomeForm } from './other-income-form';
import { OtherIncomesTable } from './other-incomes-table';
import { TuitionPaymentsTable } from './tuition-payments-table';
import { useIncomesPageState } from './use-incomes-page-state';

export function IncomesPage() {
  const state = useIncomesPageState();
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const { canEdit } = usePermissions();
  const canEditIncomes = canEdit('incomes');
  const hasSearch = state.searchQuery.trim().length > 0;
  const visibleTuition = state.activeTab !== 'other' ? state.filteredTuitionPayments : [];
  const visibleOther = state.activeTab !== 'tuition' ? state.filteredOtherIncomes : [];
  const hasVisibleRows = visibleTuition.length + visibleOther.length > 0;
  const pendingIncome = pendingDeleteId
    ? state.otherIncomes.find((income) => income.id === pendingDeleteId) || null
    : null;

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const completed = await state.removeIncome(pendingDeleteId);
    if (completed) setPendingDeleteId(null);
  };

  if (state.loading) {
    return <IncomeLoadingState />;
  }

  if (state.error) {
    return <IncomesError message={state.error} onRetry={state.reload} />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <IncomesHeader
        viewMode={state.viewMode}
        selectedMonth={state.selectedMonth}
        searchQuery={state.searchQuery}
        exporting={state.exporting}
        showForm={state.showForm}
        editingId={state.editingId}
        canEdit={canEditIncomes}
        onViewModeChange={state.setViewMode}
        onMonthChange={state.setSelectedMonth}
        onSearchChange={state.setSearchQuery}
        onExport={state.exportRevenue}
        onCreateClick={state.openCreateForm}
      />

      <IncomeSummaryStrip summary={state.summary} />

      {state.showForm && canEditIncomes ? (
        <OtherIncomeForm
          formData={state.formData}
          editingId={state.editingId}
          saving={state.saving}
          onUpdate={state.updateForm}
          onSubmit={state.submitForm}
          onCancel={state.resetForm}
        />
      ) : null}

      {state.viewMode === 'calendar' ? (
        <IncomeCalendar
          otherIncomes={state.otherIncomes}
          tuitionPayments={state.tuitionPayments}
          onMonthChange={state.setSelectedMonth}
          initialYearMonth={state.selectedMonth}
        />
      ) : (
        <div className="space-y-4">
          <IncomeTabs
            activeTab={state.activeTab}
            tuitionCount={state.tuitionPayments.length}
            otherCount={state.otherIncomes.length}
            onTabChange={state.setActiveTab}
          />

          {visibleTuition.length > 0 ? <TuitionPaymentsTable payments={visibleTuition} /> : null}
          {visibleOther.length > 0 ? (
            <OtherIncomesTable
              incomes={visibleOther}
              canEdit={canEditIncomes}
              onSelect={state.setSelectedIncome}
              onEdit={state.editIncome}
              onDelete={setPendingDeleteId}
            />
          ) : null}
          {!hasVisibleRows && !state.showForm ? <IncomesEmptyState hasSearch={hasSearch} /> : null}
        </div>
      )}

      <OtherIncomeDetailDialog
        income={state.selectedIncome}
        canEdit={canEditIncomes}
        onClose={() => state.setSelectedIncome(null)}
        onEdit={state.editIncome}
        onDelete={setPendingDeleteId}
      />
      <IncomeDeleteDialog
        busy={state.actionBusy}
        income={pendingIncome}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
