import { CalendarX2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';
import { MobileBottomBar, MobileErrorCard, MobileSkeleton } from '../mobile-home/mobile-screen';
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
    return <MobileSkeleton className="h-40" testId="mobile-attendance-loading" />;
  }

  if (error) {
    return <MobileErrorCard message={error} onRetry={onRetry} />;
  }

  if (!scheduleId && students.length === 0) {
    return (
      <div className="rounded-2xl bg-card">
        <EmptyState icon={CalendarX2} title={`${dateLabel} ${getTimeSlotLabel(timeSlot)}에 등록된 수업이 없어요`} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-2xl bg-card">
        <EmptyState icon={Users} title="배정된 학생이 없어요" />
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

      <MobileBottomBar>
        <Button type="button" size="lg" className="w-full" onClick={onAllPresent} disabled={saving}>
          전체 출석
        </Button>
      </MobileBottomBar>
    </>
  );
}
