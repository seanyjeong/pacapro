import { UserCog } from 'lucide-react';
import type {
  Instructor,
  InstructorAttendanceState,
  InstructorClockField,
} from './time-slot-detail-types';
import { InstructorAttendanceCard } from './instructor-attendance-card';

interface InstructorAttendanceSectionProps {
  instructors: Instructor[];
  attendances: Record<number, InstructorAttendanceState>;
  saving: boolean;
  onStatusChange: (instructorId: number, status: string) => void;
  onTimeChange: (instructorId: number, field: InstructorClockField, value: string) => void;
  onTimeSave: (instructorId: number) => void;
  onClock: (instructorId: number, field: InstructorClockField) => void;
}

export function InstructorAttendanceSection({
  instructors,
  attendances,
  saving,
  onStatusChange,
  onTimeChange,
  onTimeSave,
  onClock,
}: InstructorAttendanceSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <UserCog className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">강사 출결</h3>
      </div>

      {instructors.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">등록된 강사가 없습니다</p>
      ) : (
        <div className="space-y-3">
          {instructors.map((instructor) => (
            <InstructorAttendanceCard
              key={instructor.id}
              instructor={instructor}
              attendance={attendances[instructor.id]}
              saving={saving}
              onStatusChange={onStatusChange}
              onTimeChange={onTimeChange}
              onTimeSave={onTimeSave}
              onClock={onClock}
            />
          ))}
        </div>
      )}
    </section>
  );
}
