import { useMemo, useState } from 'react';
import { User, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/lib/types/schedule';
import { MakeupStudentSearch } from './makeup-student-search';
import { StudentAttendanceCard } from './student-attendance-card';
import { groupStudentsByPlacement, sortStudentsForAttendance } from './time-slot-detail-utils';
import type {
  AttendanceStudent,
  ReasonInputState,
  SearchStudent,
  StudentAttendanceState,
  StudentPlacementGroup,
} from './time-slot-detail-types';

type PlacementFilter = number | 'none' | null;

function PlacementChip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors',
        active ? 'bg-foreground text-background' : 'bg-muted text-secondary-foreground hover:text-foreground',
      )}
    >
      {label}
      <span className={cn('text-xs tabular-nums', active ? 'text-background/80' : 'text-muted-foreground')}>{count}</span>
    </button>
  );
}

function groupTitle(group: StudentPlacementGroup): string {
  if (group.branchId === null) return '지점 없음';
  return `${group.branchName} · ${group.classId === null ? '반 없음' : group.className}`;
}

function countStudents(groups: StudentPlacementGroup[]): number {
  return groups.reduce((sum, group) => sum + group.students.length, 0);
}

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
  // 지점·반을 쓰는 학원이면 지점 → 반 순서로 골라 보고, '전체'에서는 지점·반별로 묶어 보여 준다.
  const groups = useMemo(() => groupStudentsByPlacement(sortStudentsForAttendance(students)), [students]);
  const usesPlacement = groups.some((group) => group.branchId !== null);
  const [branchFilter, setBranchFilter] = useState<PlacementFilter>(null);
  const [classFilter, setClassFilter] = useState<PlacementFilter>(null);

  const branchOptions = useMemo(() => {
    const seen = new Map<number | 'none', { id: number | 'none'; name: string; groups: StudentPlacementGroup[] }>();
    for (const group of groups) {
      const id = group.branchId ?? 'none';
      const option = seen.get(id) ?? { id, name: group.branchName ?? '지점 없음', groups: [] };
      option.groups.push(group);
      seen.set(id, option);
    }
    return [...seen.values()];
  }, [groups]);
  const selectedBranch = branchOptions.find((option) => option.id === branchFilter) ?? null;
  const visibleGroups = groups.filter((group) => {
    if (branchFilter === null || !selectedBranch) return true;
    if ((group.branchId ?? 'none') !== branchFilter) return false;
    return classFilter === null || (group.classId ?? 'none') === classFilter;
  });

  const renderCard = (student: AttendanceStudent) => (
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
  );

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[15px] font-bold text-foreground">학생 출결</h3>
        <Badge variant="secondary">{students.length}명</Badge>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={() => onShowAddStudent(true)}
        >
          <UserPlus className="h-4 w-4" />
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

      {usesPlacement && students.length > 0 && (
        <div className="mb-3 space-y-1.5" aria-label="지점·반으로 보기">
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
            <PlacementChip
              active={branchFilter === null}
              label="전체"
              count={students.length}
              onClick={() => { setBranchFilter(null); setClassFilter(null); }}
            />
            {branchOptions.map((option) => (
              <PlacementChip
                key={option.id}
                active={branchFilter === option.id}
                label={option.name}
                count={countStudents(option.groups)}
                onClick={() => { setBranchFilter(option.id); setClassFilter(null); }}
              />
            ))}
          </div>
          {selectedBranch && selectedBranch.id !== 'none' && (
            <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
              <PlacementChip
                active={classFilter === null}
                label={`${selectedBranch.name} 전체`}
                count={countStudents(selectedBranch.groups)}
                onClick={() => setClassFilter(null)}
              />
              {selectedBranch.groups.map((group) => (
                <PlacementChip
                  key={group.key}
                  active={classFilter === (group.classId ?? 'none')}
                  label={group.classId === null ? '반 없음' : group.className ?? ''}
                  count={group.students.length}
                  onClick={() => setClassFilter(group.classId ?? 'none')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {students.length === 0 ? (
        <EmptyState icon={User} title="배정된 학생이 없어요" className="py-6" />
      ) : usesPlacement ? (
        <div className="space-y-5">
          {visibleGroups.map((group) => (
            <section key={group.key} aria-label={groupTitle(group)}>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
                {groupTitle(group)}
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{group.students.length}명</span>
              </h4>
              <div className="grid gap-2 xl:grid-cols-2">
                {group.students.map(renderCard)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 xl:grid-cols-2">
          {sortStudentsForAttendance(students).map(renderCard)}
        </div>
      )}
    </section>
  );
}
