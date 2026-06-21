import { User, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TimeSlot } from '@/lib/types/schedule';
import { MakeupStudentSearch } from './makeup-student-search';
import { StudentAttendanceCard } from './student-attendance-card';
import { sortStudentsForAttendance } from './time-slot-detail-utils';
import type {
  AttendanceStudent,
  ReasonInputState,
  SearchStudent,
  StudentAttendanceState,
} from './time-slot-detail-types';

interface StudentAttendanceSectionProps {
  date: string;
  timeSlot: TimeSlot;
  students: AttendanceStudent[];
  attendances: Record<number, StudentAttendanceState>;
  savingStudent: number | null;
  movingStudent: number | null;
  reasonInput: ReasonInputState | null;
  showAddStudent: boolean;
  searchQuery: string;
  searchResults: SearchStudent[];
  isSearching: boolean;
  isAddingStudent: boolean;
  onShowAddStudent: (show: boolean) => void;
  onCloseMakeupSearch: () => void;
  onSearchStudent: (query: string) => void;
  onAddMakeupStudent: (studentId: number, studentName: string) => void;
  onStudentAttendance: (studentId: number, status: string) => void;
  onMoveStudent: (studentId: number, toSlot: TimeSlot) => void;
  onReasonChange: (reasonInput: ReasonInputState) => void;
  onReasonConfirm: () => void;
  onReasonCancel: () => void;
}

export function StudentAttendanceSection({
  date,
  timeSlot,
  students,
  attendances,
  savingStudent,
  movingStudent,
  reasonInput,
  showAddStudent,
  searchQuery,
  searchResults,
  isSearching,
  isAddingStudent,
  onShowAddStudent,
  onCloseMakeupSearch,
  onSearchStudent,
  onAddMakeupStudent,
  onStudentAttendance,
  onMoveStudent,
  onReasonChange,
  onReasonConfirm,
  onReasonCancel,
}: StudentAttendanceSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <User className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">학생 출결</h3>
        <Badge variant="secondary">{students.length}명</Badge>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 text-xs"
          onClick={() => onShowAddStudent(true)}
        >
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          보충 추가
        </Button>
      </div>

      {showAddStudent && (
        <MakeupStudentSearch
          query={searchQuery}
          results={searchResults}
          isSearching={isSearching}
          isAddingStudent={isAddingStudent}
          onSearch={onSearchStudent}
          onAddStudent={onAddMakeupStudent}
          onClose={onCloseMakeupSearch}
        />
      )}

      {students.length === 0 ? (
        <div className="py-8 text-center">
          <User className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground text-sm">배정된 학생이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortStudentsForAttendance(students).map((student) => (
            <StudentAttendanceCard
              key={student.student_id}
              date={date}
              timeSlot={timeSlot}
              student={student}
              currentData={attendances[student.student_id]}
              isSaving={savingStudent === student.student_id}
              isMoving={movingStudent === student.student_id}
              reasonInput={reasonInput}
              onAttendance={onStudentAttendance}
              onMove={onMoveStudent}
              onReasonChange={onReasonChange}
              onReasonConfirm={onReasonConfirm}
              onReasonCancel={onReasonCancel}
            />
          ))}
        </div>
      )}
    </section>
  );
}
