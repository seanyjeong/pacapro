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
    <div className="flex gap-1 rounded-xl bg-muted p-1" aria-label="시간대">
      {DETAIL_TIME_SLOTS.map((slot) => {
        const selected = selectedSlots.includes(slot);
        return (
          <button
            key={slot}
            className={`h-9 min-w-11 rounded-lg px-2.5 text-[13px] font-semibold transition ${
              selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
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
