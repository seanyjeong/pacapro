import { UserCheck } from 'lucide-react';
import { TIME_SLOT_LABELS, type TimeSlot } from '@/lib/types/schedule';
import { cn } from '@/lib/utils';
import { INSTRUCTOR_ATTENDANCE_TIME_SLOTS } from './instructor-attendance-constants';
import type { InstructorAttendanceStats, SlotCounts } from './instructor-attendance-types';

interface Props {
  date: string;
  dayOfWeek: string;
  selectedTimeSlot: TimeSlot;
  slotCounts: SlotCounts;
  stats: InstructorAttendanceStats;
  onTimeSlotChange: (timeSlot: TimeSlot) => void;
}

export function InstructorAttendanceSummaryCard({
  date,
  dayOfWeek,
  selectedTimeSlot,
  slotCounts,
  stats,
  onTimeSlotChange,
}: Props) {
  return (
    <section className="rounded-2xl bg-card p-5">
        <p className="flex items-center gap-2 text-[15px] font-bold text-foreground">
          <UserCheck className="h-5 w-5 text-muted-foreground" />
          {date} ({dayOfWeek})
        </p>
        <div className="mb-4 mt-4">
          <label className="mb-2 block text-[13px] font-semibold text-secondary-foreground">시간대 선택</label>
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {INSTRUCTOR_ATTENDANCE_TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                className={cn(
                  'h-10 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors',
                  selectedTimeSlot === slot
                    ? 'bg-card text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onTimeSlotChange(slot)}
              >
                {TIME_SLOT_LABELS[slot]}
                {slotCounts[slot] > 0 && <span className="ml-1 text-xs">({slotCounts[slot]}명)</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          <AttendanceStat label="전체" value={stats.total} className="text-foreground" />
          <AttendanceStat label="출근" value={stats.present} className="text-success" />
          <AttendanceStat label="결근" value={stats.absent} className="text-destructive" />
          <AttendanceStat label="지각" value={stats.late} className="text-warning" />
          <AttendanceStat label="반차" value={stats.halfDay} className="text-primary" />
        </div>
    </section>
  );
}

function AttendanceStat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-xl bg-muted px-1 py-2.5 text-center">
      <p className={cn('text-xl font-extrabold tabular-nums', className)}>{value}</p>
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}
