import { CheckCircle, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SeasonEnrollStudent } from './season-enroll-types';

interface SeasonEnrollStudentRowProps {
  enrolling: boolean;
  student: SeasonEnrollStudent;
  type: 'available' | 'enrolled';
  onEnrollClick: (student: SeasonEnrollStudent) => void;
}

export function SeasonEnrollStudentRow({ enrolling, student, type, onEnrollClick }: SeasonEnrollStudentRowProps) {
  const isAvailable = type === 'available';

  return (
    <div
      className="grid min-w-0 grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      data-testid={isAvailable ? 'available-student-row' : 'enrolled-student-row'}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">{student.name}</p>
        <p className="mt-1 truncate text-xs text-slate-500">
          {student.grade || student.grade_type} · {student.phone}
        </p>
      </div>
      {isAvailable ? (
        <Button size="sm" onClick={() => onEnrollClick(student)} disabled={enrolling}>
          {enrolling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <UserPlus className="mr-1 h-4 w-4" />
              시간대 선택
            </>
          )}
        </Button>
      ) : (
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <CheckCircle className="h-4 w-4" />
          등록 완료
        </div>
      )}
    </div>
  );
}
