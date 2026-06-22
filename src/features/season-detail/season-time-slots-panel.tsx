import type { Season } from '@/lib/types/season';
import { SEASON_TARGET_GRADES, TIME_SLOT_LABELS } from '@/lib/types/season';
import { parseGradeTimeSlots, normalizeTimeSlots } from './season-detail-utils';

interface SeasonTimeSlotsPanelProps {
  season: Season;
}

export function SeasonTimeSlotsPanel({ season }: SeasonTimeSlotsPanelProps) {
  const gradeTimeSlots = parseGradeTimeSlots(season.grade_time_slots);

  return (
    <section className="rounded-md border border-border bg-card p-5" aria-labelledby="season-time-slots-title">
      <h2 id="season-time-slots-title" className="text-lg font-semibold text-foreground">
        학년별 수업 시간대
      </h2>
      {gradeTimeSlots ? (
        <div className="mt-4 divide-y divide-border">
          {SEASON_TARGET_GRADES.map((grade) => {
            const slots = normalizeTimeSlots(gradeTimeSlots[grade]);
            return (
              <div key={grade} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                <span className="text-sm font-medium text-foreground">{grade}</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {slots.length > 0 ? (
                    slots.map((slot) => (
                      <span key={slot} className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground">
                        {TIME_SLOT_LABELS[slot]}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                      미설정
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">설정된 시간대가 없습니다.</p>
      )}
    </section>
  );
}
