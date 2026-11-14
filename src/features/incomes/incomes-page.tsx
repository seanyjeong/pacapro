'use client';

import { useState } from 'react';
import { IncomeCalendar } from '@/components/incomes/income-calendar';
import { usePermissions } from '@/lib/utils/permissions';
import { IncomeDeleteDialog } from './income-delete-dialog';
import { IncomeLoadingState } from './income-loading-state';
import { IncomeSummaryStrip } from './income-summary-strip';
import { IncomesError } from './incomes-error';
import { IncomesEmptyState } from './incomes-empty-state';
import { IncomesFilterBar } from './incomes-filter-bar';
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
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4">
      <IncomesHeader
        exporting={state.exporting}
        showForm={state.showForm}
        editingId={state.editingId}
        canEdit={canEditIncomes}
        onExport={state.exportRevenue}
        onCreateClick={state.openCreateForm}
      />

      <IncomeSummaryStrip summary={state.summary} activeTab={state.activeTab} onTabChange={state.setActiveTab} />

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

      <section className="min-w-0 rounded-2xl bg-card">
        <div className="border-b border-border/60 p-4 sm:px-6 sm:py-5">
          <IncomesFilterBar
            activeTab={state.activeTab}
            searchQuery={state.searchQuery}
            selectedMonth={state.selectedMonth}
            viewMode={state.viewMode}
            tuitionCount={state.tuitionPayments.length}
            otherCount={state.otherIncomes.length}
            onMonthChange={state.setSelectedMonth}
            onSearchChange={state.setSearchQuery}
            onTabChange={state.setActiveTab}
            onViewModeChange={state.setViewMode}
          />
        </div>

        {state.viewMode === 'calendar' ? (
          <div className="p-4 sm:p-6">
            <IncomeCalendar
              otherIncomes={state.otherIncomes}
              tuitionPayments={state.tuitionPayments}
              onMonthChange={state.setSelectedMonth}
              initialYearMonth={state.selectedMonth}
            />
          </div>
        ) : (
          <div className="divide-y divide-border/60">
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
      </section>

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
