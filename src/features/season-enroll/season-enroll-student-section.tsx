import type { SeasonEnrollStudent } from './season-enroll-types';
import { SeasonEnrollStudentRow } from './season-enroll-student-row';

interface SeasonEnrollStudentSectionProps {
  emptyMessage: string;
  enrollingId: number | null;
  students: SeasonEnrollStudent[];
  title: string;
  type: 'available' | 'enrolled';
  onEnrollClick: (student: SeasonEnrollStudent) => void;
}

export function SeasonEnrollStudentSection({
  emptyMessage,
  enrollingId,
  students,
  title,
  type,
  onEnrollClick,
}: SeasonEnrollStudentSectionProps) {
  return (
    <div className="min-w-0">
      <div className="border-b border-border bg-muted px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {students.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="divide-y divide-border">
          {students.map((student) => (
            <SeasonEnrollStudentRow
              key={student.id}
              enrolling={enrollingId === student.id}
              student={student}
              type={type}
              onEnrollClick={onEnrollClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
