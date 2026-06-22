import type { TimeSlot } from '@/lib/types/season';
import { TIME_SLOT_LABELS } from '@/lib/types/season';
import { DETAIL_TIME_SLOTS } from './season-detail-utils';

interface SeasonTimeSlotToggleGroupProps {
  selectedSlots: TimeSlot[];
  updating: boolean;
  onChange: (slot: TimeSlot) => void;
}

export function SeasonTimeSlotToggleGroup({ selectedSlots, updating, onChange }: SeasonTimeSlotToggleGroupProps) {
  return (
    <div className="flex gap-1" aria-label="시간대">
      {DETAIL_TIME_SLOTS.map((slot) => {
        const selected = selectedSlots.includes(slot);
        return (
          <button
            key={slot}
            className={`rounded-md px-2 py-1 text-xs transition ${
              selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            } ${updating ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={updating}
            type="button"
            onClick={() => onChange(slot)}
          >
            {TIME_SLOT_LABELS[slot]}
          </button>
        );
      })}
    </div>
  );
}
