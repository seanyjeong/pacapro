import type { Season } from '@/lib/types/season';
import { SEASON_TARGET_GRADES, TIME_SLOT_LABELS } from '@/lib/types/season';
import { parseGradeTimeSlots, normalizeTimeSlots } from './season-detail-utils';

interface SeasonTimeSlotsPanelProps {
  season: Season;
}

export function SeasonTimeSlotsPanel({ season }: SeasonTimeSlotsPanelProps) {
  const gradeTimeSlots = parseGradeTimeSlots(season.grade_time_slots);

  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6" aria-labelledby="season-time-slots-title">
      <h2 id="season-time-slots-title" className="text-[17px] font-bold tracking-tight text-foreground">
        학년별 수업 시간대
      </h2>
      {gradeTimeSlots ? (
        <div className="mt-3 divide-y divide-border/60">
          {SEASON_TARGET_GRADES.map((grade) => {
            const slots = normalizeTimeSlots(gradeTimeSlots[grade]);
            return (
              <div key={grade} className="flex items-center justify-between gap-4 py-3">
                <span className="text-[15px] font-semibold text-foreground">{grade}</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {slots.length > 0 ? (
                    slots.map((slot) => (
                      <span key={slot} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {TIME_SLOT_LABELS[slot]}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      미설정
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">설정된 시간대가 없어요.</p>
      )}
    </section>
  );
}
