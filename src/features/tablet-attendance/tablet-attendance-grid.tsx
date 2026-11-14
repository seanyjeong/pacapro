import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';
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
          <div key={index} className="h-40 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl bg-destructive-soft p-5 text-destructive">
        <p className="text-[15px] font-semibold">{error}</p>
        <Button variant="outline" className="mt-3 bg-card" onClick={onRetry}>
          다시 불러오기
        </Button>
      </div>
    );
  }

  if (totalStudents === 0) {
    return (
      <div className="rounded-2xl bg-card py-6">
        <EmptyState icon={Users} title="배정된 학생이 없어요" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-2xl bg-card py-6">
        <EmptyState icon={Users} title="조건에 맞는 학생이 없어요" />
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
