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
import { ExpensesHeader } from './expenses-header';
import { ExpensesOperationsBoard } from './expenses-operations-board';
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
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <ExpensesHeader
        viewMode={state.viewMode}
        selectedMonth={state.selectedMonth}
        searchQuery={state.searchQuery}
        exporting={state.exporting}
        showForm={state.showForm}
        editingId={state.editingId}
        canEdit={canEditExpenses}
        onViewModeChange={state.setViewMode}
        onMonthChange={state.setSelectedMonth}
        onSearchChange={state.setSearchQuery}
        onExport={state.exportExpenses}
        onCreateClick={state.openCreateForm}
      />

      <ExpenseSummaryStrip summary={state.summary} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <main className="order-2 min-w-0 space-y-5 xl:order-1">
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

          {state.viewMode === 'calendar' ? (
            <ExpenseCalendar
              expenses={state.expenses}
              onMonthChange={state.setSelectedMonth}
              initialYearMonth={state.selectedMonth}
            />
          ) : (
            <div className="space-y-4">
              {state.filteredExpenses.length > 0 ? (
                <ExpensesTable
                  expenses={state.filteredExpenses}
                  canEdit={canEditExpenses}
                  onSelect={state.setSelectedExpense}
                  onEdit={state.editExpense}
                  onDelete={openDeleteDialog}
                  onCompleteRefund={openRefundDialog}
                />
              ) : null}
              {state.filteredExpenses.length === 0 && !state.showForm ? <ExpensesEmptyState hasSearch={hasSearch} /> : null}
            </div>
          )}
        </main>
        <div className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2">
          <ExpensesOperationsBoard
            canEdit={canEditExpenses}
            editingId={state.editingId}
            exporting={state.exporting}
            searchQuery={state.searchQuery}
            selectedMonth={state.selectedMonth}
            showForm={state.showForm}
            summary={state.summary}
            viewMode={state.viewMode}
            onCreateClick={state.openCreateForm}
            onExport={state.exportExpenses}
            onMonthChange={state.setSelectedMonth}
            onSearchChange={state.setSearchQuery}
            onViewModeChange={state.setViewMode}
          />
        </div>
      </div>

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
