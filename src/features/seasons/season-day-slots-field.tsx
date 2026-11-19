import type { OperatingDaySlots, TimeSlot } from '@/lib/types/season';
import { OPERATING_DAY_OPTIONS, TIME_SLOT_OPTIONS, operatingSlotsForDay } from '@/lib/types/season';

interface SeasonDaySlotsFieldProps {
  operatingDays: number[];
  daySlots: OperatingDaySlots | undefined;
  onToggle: (day: number, slot: TimeSlot) => void;
}

/** 요일별 운영 시간대: 고른 운영 요일마다 오전·오후·저녁을 켜고 끈다. 끈 시간대에는 그 요일 시즌 수업이 생기지 않는다. */
export function SeasonDaySlotsField({ operatingDays, daySlots, onToggle }: SeasonDaySlotsFieldProps) {
  const days = OPERATING_DAY_OPTIONS.filter((day) => operatingDays.includes(day.value));
  if (days.length === 0) return null;

  return (
    <div data-testid="season-day-slots">
      <p className="text-[13px] font-semibold text-secondary-foreground">요일별 운영 시간대</p>
      <p className="mt-1 text-[12px] text-muted-foreground">끈 시간대에는 그 요일 시즌 수업이 생기지 않아요. 일할계산·환불은 운영 요일 그대로 셉니다.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {days.map((day) => {
          const slots = operatingSlotsForDay(daySlots, day.value);
          return (
            <div key={day.value} className="grid grid-cols-[36px_1fr] items-center gap-2 rounded-xl bg-muted p-2.5">
              <span className="text-center text-sm font-semibold text-foreground">{day.label}</span>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOT_OPTIONS.map((slot) => {
                  const selected = slots.includes(slot.value);
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${day.label}요일 ${slot.label}`}
                      className={`h-9 rounded-lg text-sm font-semibold transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-card text-secondary-foreground hover:text-foreground'}`}
                      onClick={() => onToggle(day.value, slot.value)}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
