'use client';

import { AttendanceListCard } from './attendance-list-card';
import { AttendanceReasonModal } from './attendance-reason-modal';
import { AttendanceStatsCard } from './attendance-stats-card';
import { MakeupStudentModal } from './makeup-student-modal';
import { useAttendanceEditor } from './use-attendance-editor';
import type { AttendanceCheckerProps } from './attendance-checker-types';

export function AttendanceChecker(props: AttendanceCheckerProps) {
  const {
    attendances,
    onSubmit,
    isSubmitting,
    readOnly = false,
    currentDate,
    timeSlot,
    onStudentAdded,
  } = props;

  const editor = useAttendanceEditor({
    attendances,
    onSubmit,
    currentDate,
    timeSlot,
    onStudentAdded,
  });

  return (
    <div className="space-y-6">
      <AttendanceStatsCard stats={editor.stats} />

      <AttendanceListCard
        attendances={attendances}
        editedAttendances={editor.editedAttendances}
        isSubmitting={isSubmitting}
        readOnly={readOnly}
        currentDate={currentDate}
        timeSlot={timeSlot}
        hasChanges={editor.hasChanges}
        onOpenAddStudent={() => editor.setShowAddStudentModal(true)}
        onSubmit={editor.handleSubmit}
        onStatusChange={editor.handleStatusChange}
        onMakeupDateChange={editor.handleMakeupDateChange}
        onNotesChange={editor.handleNotesChange}
      />

      {editor.showAddStudentModal && (
        <MakeupStudentModal
          query={editor.searchQuery}
          results={editor.searchResults}
          isSearching={editor.isSearching}
          isAddingStudent={editor.isAddingStudent}
          onQueryChange={editor.setSearchQuery}
          onSearch={editor.handleSearch}
          onAddStudent={editor.handleAddMakeupStudent}
          onClose={editor.closeAddStudentModal}
        />
      )}

      {editor.reasonModalData && (
        <AttendanceReasonModal
          data={editor.reasonModalData}
          onChange={editor.setReasonModalData}
          onCancel={() => editor.setReasonModalData(null)}
          onConfirm={editor.handleReasonConfirm}
        />
      )}
    </div>
  );
}
