'use client';

import { PermissionModal } from '@/components/staff/permission-modal';
import { StaffDeleteDialog } from '@/components/staff/staff-delete-dialog';
import { StaffFormModal } from '@/components/staff/staff-form-modal';
import { StaffList } from '@/components/staff/staff-list';
import { StaffPageHeader } from './staff-page-header';
import { StaffPageError, StaffPageLoading } from './staff-page-states';
import { StaffSummaryStrip } from './staff-summary-strip';
import { StaffWorkQueue } from './staff-work-queue';
import { useStaffPageState } from './use-staff-page-state';

export function StaffPage() {
  const state = useStaffPageState();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5" data-testid="staff-operations-workspace">
      <StaffPageHeader
        canAddStaff={state.availableInstructors.length > 0}
        loading={state.loading}
        onAddStaff={state.handleAddStaff}
        onRefresh={state.loadData}
      />

      {state.error && !state.loading ? (
        <StaffPageError error={state.error} onRetry={state.loadData} />
      ) : (
        <>
          <StaffSummaryStrip summary={state.summary} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
            <main className="min-w-0">
              {state.loading ? (
                <StaffPageLoading />
              ) : (
                <StaffList
                  staff={state.staffList}
                  loading={state.loading}
                  onEditPermission={state.handleEditPermission}
                  onEdit={state.handleEditStaff}
                  onDelete={state.handleDeleteStaff}
                />
              )}
            </main>
            <StaffWorkQueue
              availableInstructors={state.availableInstructors}
              staff={state.staffList}
              onAddStaff={state.handleAddStaff}
            />
          </div>
        </>
      )}

      {state.showFormModal ? (
        <StaffFormModal
          staff={state.selectedStaff}
          availableInstructors={state.availableInstructors}
          onClose={() => state.setShowFormModal(false)}
          onSubmit={state.handleFormSubmit}
        />
      ) : null}

      {state.showPermissionModal && state.selectedStaff ? (
        <PermissionModal
          staff={state.selectedStaff}
          onClose={() => state.setShowPermissionModal(false)}
          onSubmit={state.handlePermissionSubmit}
        />
      ) : null}

      <StaffDeleteDialog
        loading={state.deleteLoading}
        open={state.deleteDialogOpen}
        staff={state.deleteTarget}
        onConfirm={() => void state.confirmDeleteStaff()}
        onOpenChange={state.handleDeleteDialogOpenChange}
      />
    </div>
  );
}
