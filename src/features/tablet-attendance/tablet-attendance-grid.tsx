import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TabletAttendanceMark, TabletAttendanceStudent } from './tablet-attendance-types';
import { TabletAttendanceCard } from './tablet-attendance-card';

interface TabletAttendanceGridProps {
  error: string | null;
  loading: boolean;
  savingId: number | null;
  students: TabletAttendanceStudent[];
  totalStudents: number;
  onChange: (student: TabletAttendanceStudent, status: TabletAttendanceMark) => void;
  onRetry: () => void;
}

export function TabletAttendanceGrid({
  error,
  loading,
  savingId,
  students,
  totalStudents,
  onChange,
  onRetry,
}: TabletAttendanceGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="tablet-attendance-loading">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="text-sm font-medium">{error}</p>
        <Button variant="outline" className="mt-3 border-rose-200 bg-white dark:border-rose-800 dark:bg-zinc-950" onClick={onRetry}>
          다시 불러오기
        </Button>
      </div>
    );
  }

  if (totalStudents === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <Users className="mx-auto h-12 w-12 text-zinc-400" />
        <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">배정된 학생이 없습니다.</p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <Users className="mx-auto h-12 w-12 text-zinc-400" />
        <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">조건에 맞는 학생이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {students.map((student) => (
        <TabletAttendanceCard
          key={student.student_id}
          saving={savingId === student.student_id || savingId === -1}
          student={student}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
