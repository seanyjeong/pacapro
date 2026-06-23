import { User } from 'lucide-react';
import type { TimeSlot } from '@/lib/types/schedule';
import type { InstructorScheduleSlotConfig } from './instructor-schedule-constants';
import { InstructorScheduleRow } from './instructor-schedule-row';
import type {
  InstructorScheduleInstructor,
  InstructorScheduleSelections,
} from './instructor-schedule-types';

interface Props {
  activeSlot: TimeSlot;
  activeSlotInfo: InstructorScheduleSlotConfig;
  instructors: InstructorScheduleInstructor[];
  selections: InstructorScheduleSelections;
  onToggleInstructor: (instructor: InstructorScheduleInstructor) => void;
  onTimeChange: (instructorId: number, field: 'startTime' | 'endTime', value: string) => void;
}

export function InstructorScheduleList({
  activeSlot,
  activeSlotInfo,
  instructors,
  selections,
  onToggleInstructor,
  onTimeChange,
}: Props) {
  if (instructors.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <User className="mx-auto mb-2 h-10 w-10 opacity-50" />
        <p>등록된 강사가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="max-h-[400px] space-y-2 overflow-y-auto">
      {instructors.map((instructor) => (
        <InstructorScheduleRow
          key={instructor.id}
          activeSlotInfo={activeSlotInfo}
          instructor={instructor}
          selection={selections[activeSlot][instructor.id]}
          onTimeChange={onTimeChange}
          onToggle={onToggleInstructor}
        />
      ))}
    </div>
  );
}
