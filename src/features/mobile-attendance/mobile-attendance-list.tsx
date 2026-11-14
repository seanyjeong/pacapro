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
          <div key={key} className="h-40 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-destructive">
        <p className="text-sm font-medium">{error}</p>
        <Button variant="outline" className="mt-3 w-full border-destructive/30 bg-card" onClick={onRetry}>
          다시 불러오기
        </Button>
      </div>
    );
  }

  if (!scheduleId && students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-secondary-foreground">
          {dateLabel} {getTimeSlotLabel(timeSlot)}에 등록된 수업이 없습니다.
        </p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-secondary-foreground">배정된 학생이 없습니다.</p>
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-4 backdrop-blur">
        <Button type="button" className="h-12 w-full" onClick={onAllPresent} disabled={saving}>
          전체 출석
        </Button>
      </div>
    </>
  );
}
