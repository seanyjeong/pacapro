import { Badge } from '@/components/ui/badge';
import type { TimeSlot } from '@/lib/types/schedule';
import { cn } from '@/lib/utils';
import { INSTRUCTOR_SCHEDULE_TIME_SLOTS } from './instructor-schedule-constants';

interface Props {
  activeSlot: TimeSlot;
  slotCounts: Record<TimeSlot, number>;
  onSlotChange: (slot: TimeSlot) => void;
}

export function InstructorScheduleSlotTabs({ activeSlot, slotCounts, onSlotChange }: Props) {
  return (
    <div className="flex gap-1 overflow-hidden rounded-xl bg-muted p-1">
      {INSTRUCTOR_SCHEDULE_TIME_SLOTS.map(({ slot, label, icon: Icon, color }) => {
        const count = slotCounts[slot];

        return (
          <button
            key={slot}
            onClick={() => onSlotChange(slot)}
            className={cn(
              'flex h-9 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm font-semibold transition-colors',
              activeSlot === slot
                ? `bg-card ${color}`
                : 'text-muted-foreground hover:text-foreground'
            )}
            type="button"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
            {count > 0 && (
              <Badge variant="secondary" className="h-4 shrink-0 px-1 text-[10px]">
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
