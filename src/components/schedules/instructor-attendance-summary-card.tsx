import { UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          강사 출근 체크 - {date} ({dayOfWeek})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium text-foreground">시간대 선택</label>
          <div className="flex gap-2">
            {INSTRUCTOR_ATTENDANCE_TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                className={cn(
                  'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                  selectedTimeSlot === slot
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-muted'
                )}
                onClick={() => onTimeSlotChange(slot)}
              >
                {TIME_SLOT_LABELS[slot]}
                {slotCounts[slot] > 0 && <span className="ml-1 text-xs">({slotCounts[slot]}명)</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4 md:grid-cols-5">
          <AttendanceStat label="전체" value={stats.total} className="text-foreground" />
          <AttendanceStat label="출근" value={stats.present} className="text-green-600 dark:text-green-400" />
          <AttendanceStat label="결근" value={stats.absent} className="text-red-600 dark:text-red-400" />
          <AttendanceStat label="지각" value={stats.late} className="text-yellow-600 dark:text-yellow-400" />
          <AttendanceStat label="반차" value={stats.halfDay} className="text-blue-600 dark:text-blue-400" />
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceStat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-2xl font-bold', className)}>{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
