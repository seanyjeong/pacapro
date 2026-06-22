import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AttendanceStatus, TimeSlot } from '@/lib/types/schedule';
import type { MarkableAttendanceStatus, MobileAttendanceStudent } from './mobile-attendance-types';
import { getTimeSlotLabel } from './mobile-attendance-utils';
import { MobileAttendanceStudentCard } from './mobile-attendance-student-card';

interface MobileAttendanceListProps {
  attendances: Map<number, AttendanceStatus>;
  dateLabel: string;
  error: string | null;
  loading: boolean;
  notes: Map<number, string>;
  saving: boolean;
  scheduleId: number | null;
  students: MobileAttendanceStudent[];
  timeSlot: TimeSlot;
  onAllPresent: () => void;
  onCall: (phone?: string | null) => void;
  onRetry: () => void;
  onStatusChange: (student: MobileAttendanceStudent, status: MarkableAttendanceStatus) => void;
}

export function MobileAttendanceList({
  attendances,
  dateLabel,
  error,
  loading,
  notes,
  saving,
  scheduleId,
  students,
  timeSlot,
  onAllPresent,
  onCall,
  onRetry,
  onStatusChange,
}: MobileAttendanceListProps) {
  if (loading) {
    return (
      <div className="space-y-3" data-testid="mobile-attendance-loading">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-40 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="text-sm font-medium">{error}</p>
        <Button variant="outline" className="mt-3 w-full border-rose-200 bg-white dark:border-rose-800 dark:bg-zinc-950" onClick={onRetry}>
          다시 불러오기
        </Button>
      </div>
    );
  }

  if (!scheduleId) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <AlertCircle className="mx-auto h-10 w-10 text-zinc-400" />
        <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {dateLabel} {getTimeSlotLabel(timeSlot)}에 등록된 수업이 없습니다.
        </p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <AlertCircle className="mx-auto h-10 w-10 text-zinc-400" />
        <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">배정된 학생이 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {students.map((student) => (
          <MobileAttendanceStudentCard
            key={student.student_id}
            attendanceStatus={attendances.get(student.student_id)}
            note={notes.get(student.student_id)}
            saving={saving}
            student={student}
            onCall={onCall}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <Button type="button" className="h-12 w-full" onClick={onAllPresent} disabled={saving}>
          전체 출석
        </Button>
      </div>
    </>
  );
}
