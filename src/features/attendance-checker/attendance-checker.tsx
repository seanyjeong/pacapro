'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClassRoster } from '@/features/class-roster/class-roster-api';
import { ClassRosterSelect } from '@/features/class-roster/class-roster-select';
import { useBranchTree } from '@/hooks/use-branches';
import type { Attendance, AttendanceStatus } from '@/lib/types/schedule';
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

  // 반으로 보기: 고른 반 재원생 전원을 보여 준다. 그날 수업에 없던 학생도 저장하면 출석이 기록된다.
  const { branches } = useBranchTree();
  const [classId, setClassId] = useState<number | null>(null);
  const roster = useQuery({
    queryKey: ['class-roster', currentDate, classId, timeSlot],
    queryFn: () => getClassRoster(currentDate as string, classId as number, timeSlot as string),
    enabled: classId !== null && Boolean(currentDate && timeSlot),
  });
  const rosterStudents = classId !== null ? roster.data?.students : undefined;
  const shownAttendances = useMemo<Attendance[]>(() => {
    if (!rosterStudents) return attendances;
    const scheduled = new Map(attendances.map((attendance) => [attendance.student_id, attendance]));
    return rosterStudents.map((student) => scheduled.get(student.student_id) ?? {
      student_id: student.student_id,
      student_name: student.student_name,
      student_number: student.student_number ?? '',
      attendance_status: student.attendance_status as AttendanceStatus | null,
      notes: student.notes ?? undefined,
    });
  }, [attendances, rosterStudents]);

  const editor = useAttendanceEditor({
    attendances: shownAttendances,
    onSubmit,
    currentDate,
    timeSlot,
    onStudentAdded,
  });

  return (
    <div className="space-y-6">
      <AttendanceStatsCard stats={editor.stats} />

      {currentDate && timeSlot && (
        <ClassRosterSelect
          branches={branches}
          classId={classId}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground sm:w-[240px]"
          onChange={setClassId}
        />
      )}

      <AttendanceListCard
        attendances={shownAttendances}
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
