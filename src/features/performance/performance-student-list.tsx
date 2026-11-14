import { GraduationCap, Loader2 } from 'lucide-react';
import type { PerformanceStudent, StudentAllScores } from './performance-types';
import { PerformanceStudentRow } from './performance-student-row';

interface PerformanceStudentListProps {
  expandedStudentId: number | null;
  scores: StudentAllScores | null;
  scoresError: string | null;
  scoresLoading: boolean;
  students: PerformanceStudent[];
  studentsLoading: boolean;
  onStudentToggle: (studentId: number) => void;
}

export function PerformanceStudentList({
  expandedStudentId,
  scores,
  scoresError,
  scoresLoading,
  students,
  studentsLoading,
  onStudentToggle,
}: PerformanceStudentListProps) {
  if (studentsLoading) {
    return (
      <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        학생 목록을 불러오는 중이에요.
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-foreground">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          학생별 모의고사 성적
        </h2>
        <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">{students.length}명</span>
      </div>

      {students.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">검색 결과가 없어요.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {students.map((student) => (
            <PerformanceStudentRow
              key={student.id}
              expanded={expandedStudentId === student.id}
              scores={expandedStudentId === student.id ? scores : null}
              scoresError={expandedStudentId === student.id ? scoresError : null}
              scoresLoading={expandedStudentId === student.id && scoresLoading}
              student={student}
              onToggle={() => onStudentToggle(student.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
