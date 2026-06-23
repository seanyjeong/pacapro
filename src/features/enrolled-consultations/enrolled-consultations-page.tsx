'use client';

import { EnrolledConsultationCreateDialog } from './enrolled-consultation-create-dialog';
import { EnrolledConsultationDeleteDialog } from './enrolled-consultation-delete-dialog';
import { EnrolledConsultationDetailDialog } from './enrolled-consultation-detail-dialog';
import { EnrolledConsultationStatusDialog } from './enrolled-consultation-status-dialog';
import { EnrolledConsultationsError } from './enrolled-consultations-error';
import { EnrolledConsultationsFilters } from './enrolled-consultations-filters';
import { EnrolledConsultationsHeader } from './enrolled-consultations-header';
import { EnrolledConsultationsList } from './enrolled-consultations-list';
import { EnrolledConsultationsPagination } from './enrolled-consultations-pagination';
import { EnrolledConsultationsStats } from './enrolled-consultations-stats';
import { EnrolledConsultationsWorkQueue } from './enrolled-consultations-work-queue';
import { useEnrolledConsultationsState } from './use-enrolled-consultations-state';

export default function EnrolledConsultationsPage() {
  const state = useEnrolledConsultationsState();
  const totalCount = state.stats.total || state.pagination.total || state.consultations.length;
  const pendingCount = state.stats.pending || state.consultations.filter((item) => item.status === 'pending').length;
  const confirmedCount = state.stats.confirmed || state.consultations.filter((item) => item.status === 'confirmed').length;
  const hasWeeklyHours = state.weeklyHours.some((hour) => hour.isAvailable && hour.startTime && hour.endTime);
  const nextConsultation = state.consultations.find((item) => item.status === 'pending' || item.status === 'confirmed') || state.consultations[0] || null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 pb-24 md:max-w-7xl" data-testid="enrolled-consultations-operations-workspace">
      <EnrolledConsultationsHeader onCreate={state.openCreateModal} />
      {state.errorMessage ? (
        <EnrolledConsultationsError message={state.errorMessage} onRetry={state.loadData} />
      ) : (
        <>
          <EnrolledConsultationsStats stats={state.stats} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="order-2 min-w-0 space-y-5 xl:order-1">
              <EnrolledConsultationsFilters
                search={state.search}
                statusFilter={state.statusFilter}
                dateFilter={state.dateFilter}
                onSearchChange={state.setSearch}
                onStatusChange={state.setStatusFilter}
                onDateFilterChange={state.setDateFilter}
                onRefresh={state.loadData}
              />
              <EnrolledConsultationsList
                consultations={state.consultations}
                loading={state.loading}
                onOpenDetail={state.openDetail}
                onOpenStatus={state.openStatusModal}
                onOpenDelete={state.openDeleteModal}
              />
              <EnrolledConsultationsPagination
                pagination={state.pagination}
                onChange={state.setPagination}
              />
            </div>
            <aside className="order-1 min-w-0 xl:order-2">
              <EnrolledConsultationsWorkQueue
                confirmedCount={confirmedCount}
                hasWeeklyHours={hasWeeklyHours}
                nextConsultation={nextConsultation}
                onCreate={state.openCreateModal}
                pendingCount={pendingCount}
                totalCount={totalCount}
              />
            </aside>
          </div>
        </>
      )}
      <EnrolledConsultationDetailDialog
        open={state.detailOpen}
        consultation={state.selectedConsultation}
        showScores={state.showScores}
        selectedExam={state.selectedExam}
        loadingScores={state.loadingScores}
        studentScores={state.studentScores}
        onOpenChange={state.setDetailOpen}
        onToggleScores={state.toggleDetailScores}
        onExamChange={state.changeSelectedExam}
      />
      <EnrolledConsultationStatusDialog
        open={state.statusModalOpen}
        newStatus={state.newStatus}
        adminNotes={state.adminNotes}
        newDate={state.newDate}
        newTime={state.newTime}
        editBookedTimes={state.editBookedTimes}
        loadingBookedTimes={state.loadingEditBookedTimes}
        updating={state.updating}
        onOpenChange={state.setStatusModalOpen}
        onStatusChange={state.setNewStatus}
        onAdminNotesChange={state.setAdminNotes}
        onDateChange={state.setNewDate}
        onTimeChange={state.setNewTime}
        onLoadBookedTimes={state.loadEditBookedTimes}
        onSave={state.handleStatusChange}
        generateTimeSlots={state.generateTimeSlots}
      />
      <EnrolledConsultationDeleteDialog
        open={state.deleteModalOpen}
        deleting={state.deleting}
        onOpenChange={state.setDeleteModalOpen}
        onDelete={state.handleDelete}
      />
      <EnrolledConsultationCreateDialog
        open={state.createModalOpen}
        students={state.students}
        loadingStudents={state.loadingStudents}
        studentSearch={state.studentSearch}
        studentDropdownOpen={state.studentDropdownOpen}
        studentDropdownRef={state.studentDropdownRef}
        createForm={state.createForm}
        creating={state.creating}
        bookedTimes={state.bookedTimes}
        loadingBookedTimes={state.loadingBookedTimes}
        createScoresLoading={state.createScoresLoading}
        createScores={state.createScores}
        onOpenChange={(open) => (open ? state.setCreateModalOpen(true) : state.closeCreateModal())}
        onStudentSearchChange={state.setStudentSearch}
        onStudentDropdownOpenChange={state.setStudentDropdownOpen}
        onSelectStudent={state.selectCreateStudent}
        onCreateFormChange={state.updateCreateForm}
        onPreferredDateChange={state.setCreatePreferredDate}
        onScoreChange={state.setCreateScore}
        onCreate={state.handleCreateConsultation}
        onCancel={state.closeCreateModal}
        generateTimeSlots={state.generateTimeSlots}
      />
    </div>
  );
}
