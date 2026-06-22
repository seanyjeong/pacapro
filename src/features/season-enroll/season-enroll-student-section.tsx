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
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {students.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="divide-y divide-slate-100">
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
