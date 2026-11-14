'use client';

import { useState } from 'react';
import { ExpenseCalendar } from '@/components/expenses/expense-calendar';
import { usePermissions } from '@/lib/utils/permissions';
import { ExpenseActionDialog } from './expense-action-dialog';
import type { PendingExpenseAction } from './expense-action-dialog';
import { ExpenseDetailDialog } from './expense-detail-dialog';
import { ExpenseForm } from './expense-form';
import { ExpenseLoadingState } from './expense-loading-state';
import { ExpenseSummaryStrip } from './expense-summary-strip';
import { ExpensesError } from './expenses-error';
import { ExpensesEmptyState } from './expenses-empty-state';
import { ExpensesFilterBar } from './expenses-filter-bar';
import { ExpensesHeader } from './expenses-header';
import { ExpensesTable } from './expenses-table';
import { useExpensesPageState } from './use-expenses-page-state';

export function ExpensesPage() {
  const state = useExpensesPageState();
  const [pendingAction, setPendingAction] = useState<PendingExpenseAction | null>(null);
  const { canEdit } = usePermissions();
  const canEditExpenses = canEdit('expenses');
  const hasSearch = state.searchQuery.trim().length > 0;
  const pendingExpense = pendingAction ? state.expenses.find((expense) => expense.id === pendingAction.id) || null : null;

  const openDeleteDialog = (id: number) => setPendingAction({ id, type: 'delete' });
  const openRefundDialog = (id: number) => setPendingAction({ id, type: 'refund' });

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const completed =
      pendingAction.type === 'delete'
        ? await state.removeExpense(pendingAction.id)
        : await state.completeRefundExpense(pendingAction.id);
    if (completed) setPendingAction(null);
  };

  if (state.loading) {
    return <ExpenseLoadingState />;
  }

  if (state.error) {
    return <ExpensesError message={state.error} onRetry={state.reload} />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4">
      <ExpensesHeader
        exporting={state.exporting}
        showForm={state.showForm}
        editingId={state.editingId}
        canEdit={canEditExpenses}
        onExport={state.exportExpenses}
        onCreateClick={state.openCreateForm}
      />

      <ExpenseSummaryStrip summary={state.summary} />

      {state.showForm && canEditExpenses ? (
        <ExpenseForm
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
          <ExpensesFilterBar
            searchQuery={state.searchQuery}
            selectedMonth={state.selectedMonth}
            viewMode={state.viewMode}
            onMonthChange={state.setSelectedMonth}
            onSearchChange={state.setSearchQuery}
            onViewModeChange={state.setViewMode}
          />
        </div>

        {state.viewMode === 'calendar' ? (
          <div className="p-4 sm:p-6">
            <ExpenseCalendar
              expenses={state.expenses}
              onMonthChange={state.setSelectedMonth}
              initialYearMonth={state.selectedMonth}
            />
          </div>
        ) : state.filteredExpenses.length > 0 ? (
          <ExpensesTable
            expenses={state.filteredExpenses}
            canEdit={canEditExpenses}
            onSelect={state.setSelectedExpense}
            onEdit={state.editExpense}
            onDelete={openDeleteDialog}
            onCompleteRefund={openRefundDialog}
          />
        ) : !state.showForm ? (
          <ExpensesEmptyState hasSearch={hasSearch} />
        ) : null}
      </section>

      <ExpenseDetailDialog
        expense={state.selectedExpense}
        canEdit={canEditExpenses}
        onClose={() => state.setSelectedExpense(null)}
        onEdit={state.editExpense}
        onDelete={openDeleteDialog}
        onCompleteRefund={openRefundDialog}
      />
      <ExpenseActionDialog
        action={pendingAction}
        busy={state.actionBusy}
        expense={pendingExpense}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
      />
    </div>
  );
}
