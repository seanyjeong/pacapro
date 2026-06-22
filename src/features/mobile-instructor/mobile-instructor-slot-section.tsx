import { Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileInstructorCard } from './mobile-instructor-card';
import type { MobileInstructor, MobileInstructorAttendanceStatus, MobileInstructorTimeSlot } from './mobile-instructor-types';
import { makeInstructorKey } from './mobile-instructor-utils';

interface MobileInstructorSlotSectionProps {
  attendances: Map<string, MobileInstructorAttendanceStatus>;
  clearedKeys: Set<string>;
  instructors: MobileInstructor[];
  label: string;
  saving: boolean;
  timeSlot: MobileInstructorTimeSlot;
  onAllPresent: (timeSlot: MobileInstructorTimeSlot) => void;
  onStatusChange: (
    instructorId: number,
    timeSlot: MobileInstructorTimeSlot,
    status: MobileInstructorAttendanceStatus
  ) => void;
}

export function MobileInstructorSlotSection({
  attendances,
  clearedKeys,
  instructors,
  label,
  saving,
  timeSlot,
  onAllPresent,
  onStatusChange,
}: MobileInstructorSlotSectionProps) {
  if (instructors.length === 0) return null;

  return (
    <section className="space-y-3" data-testid="mobile-instructor-slot">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-zinc-950 dark:text-zinc-50">
          <Clock className="h-4 w-4 shrink-0 text-zinc-500" />
          <span>{label}</span>
          <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">{instructors.length}명</span>
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAllPresent(timeSlot)}
          disabled={saving}
          aria-label={`${label} 전체 출근`}
          className="shrink-0"
        >
          <Check className="mr-1 h-4 w-4" />
          전체 출근
        </Button>
      </div>

      <div className="space-y-3">
        {instructors.map((instructor) => {
          const key = makeInstructorKey(instructor.id, timeSlot);
          return (
            <MobileInstructorCard
              key={key}
              attendanceStatus={attendances.get(key)}
              cleared={clearedKeys.has(key)}
              instructor={instructor}
              saving={saving}
              onStatusChange={(status) => onStatusChange(instructor.id, timeSlot, status)}
            />
          );
        })}
      </div>
    </section>
  );
}
