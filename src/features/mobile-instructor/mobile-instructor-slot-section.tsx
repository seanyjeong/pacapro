import { Check } from 'lucide-react';
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
    <section className="rounded-2xl bg-card px-4 pb-3 pt-4" data-testid="mobile-instructor-slot">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-baseline gap-1.5 text-[17px] font-bold text-foreground">
          <span>{label}</span>
          <span className="text-sm font-medium text-muted-foreground">{instructors.length}명</span>
        </h2>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onAllPresent(timeSlot)}
          disabled={saving}
          aria-label={`${label} 전체 출근`}
          className="shrink-0"
        >
          <Check className="h-4 w-4" />
          전체 출근
        </Button>
      </div>

      <div className="mt-1 divide-y divide-border/60">
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
