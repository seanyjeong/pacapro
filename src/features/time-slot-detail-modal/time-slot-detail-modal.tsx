'use client';

import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { InstructorAttendanceSection } from './instructor-attendance-section';
import { StudentAttendanceSection } from './student-attendance-section';
import { TimeSlotDetailHeader } from './time-slot-detail-header';
import { useTimeSlotDetailState } from './use-time-slot-detail-state';
import type { TimeSlotDetailModalProps } from './time-slot-detail-types';

export function TimeSlotDetailModal({
  open,
  date,
  timeSlot,
  onClose,
  onStudentMoved,
}: TimeSlotDetailModalProps) {
  const state = useTimeSlotDetailState({ open, date, timeSlot, onStudentMoved });

  if (!date || !timeSlot) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        <TimeSlotDetailHeader
          date={date}
          timeSlot={timeSlot}
          studentCount={state.students.length}
          onClose={onClose}
        />

        <div className="p-5 overflow-y-auto flex-1">
          {state.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              <InstructorAttendanceSection
                instructors={state.instructors}
                attendances={state.instructorAttendances}
                saving={state.savingInstructor}
                onStatusChange={state.handleInstructorStatus}
                onTimeChange={state.handleInstructorTimeChange}
                onTimeSave={state.saveInstructorTime}
                onClock={state.clockInstructor}
              />

              <div className="border-t border-border" />

              <StudentAttendanceSection
                date={date}
                timeSlot={timeSlot}
                students={state.students}
                attendances={state.studentAttendances}
                savingStudent={state.savingStudent}
                movingStudent={state.movingStudent}
                reasonInput={state.reasonInput}
                showAddStudent={state.showAddStudent}
                searchQuery={state.searchQuery}
                searchResults={state.searchResults}
                isSearching={state.isSearching}
                isAddingStudent={state.isAddingStudent}
                onShowAddStudent={state.setShowAddStudent}
                onCloseMakeupSearch={state.closeMakeupSearch}
                onSearchStudent={state.handleSearchStudent}
                onAddMakeupStudent={state.handleAddMakeupStudent}
                onStudentAttendance={state.handleStudentAttendance}
                onMoveStudent={state.handleMoveStudent}
                onReasonChange={state.setReasonInput}
                onReasonConfirm={state.handleReasonConfirm}
                onReasonCancel={state.handleReasonCancel}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
