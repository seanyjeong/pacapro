import { UserCog } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { INSTRUCTOR_ATTENDANCE_STATUS } from './time-slot-detail-constants';
import { calculateHours } from './time-slot-detail-utils';
import type {
  Instructor,
  InstructorAttendanceState,
  InstructorClockField,
} from './time-slot-detail-types';

interface InstructorAttendanceCardProps {
  instructor: Instructor;
  attendance?: InstructorAttendanceState;
  saving: boolean;
  onStatusChange: (instructorId: number, status: string) => void;
  onTimeChange: (instructorId: number, field: InstructorClockField, value: string) => void;
  onTimeSave: (instructorId: number) => void;
  onClock: (instructorId: number, field: InstructorClockField) => void;
}

export function InstructorAttendanceCard({
  instructor,
  attendance,
  saving,
  onStatusChange,
  onTimeChange,
  onTimeSave,
  onClock,
}: InstructorAttendanceCardProps) {
  const isHourly = instructor.salary_type === 'hourly';

  return (
    <div className="p-3 bg-muted rounded-lg space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
            <UserCog className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <span className="font-medium text-foreground truncate">{instructor.name}</span>
            {isHourly && (
              <span className="ml-2 text-xs text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                시급
              </span>
            )}
          </div>
        </div>

        {isHourly ? (
          <HourlyInstructorControls
            instructorId={instructor.id}
            attendance={attendance}
            saving={saving}
            onStatusChange={onStatusChange}
            onClock={onClock}
          />
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {INSTRUCTOR_ATTENDANCE_STATUS.map((status) => {
              const isSelected = attendance?.status === status.value;
              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => onStatusChange(instructor.id, status.value)}
                  disabled={saving}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-all border shadow-sm active:scale-95',
                    isSelected
                      ? `${status.color} text-white border-transparent shadow-md`
                      : 'bg-background text-foreground border-border hover:border-primary/50 hover:shadow'
                  )}
                >
                  {status.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isHourly && (attendance?.checkIn || attendance?.checkOut) && (
        <div className="flex items-center gap-2 pl-0 sm:pl-11 flex-wrap">
          <Input
            type="time"
            value={attendance?.checkIn || ''}
            onChange={(event) => onTimeChange(instructor.id, 'checkIn', event.target.value)}
            onBlur={() => onTimeSave(instructor.id)}
            className="w-28 h-8 text-sm"
            aria-label={`${instructor.name} 출근 시간`}
          />
          <span className="text-muted-foreground shrink-0">~</span>
          <Input
            type="time"
            value={attendance?.checkOut || ''}
            onChange={(event) => onTimeChange(instructor.id, 'checkOut', event.target.value)}
            onBlur={() => onTimeSave(instructor.id)}
            className="w-28 h-8 text-sm"
            aria-label={`${instructor.name} 퇴근 시간`}
          />
          {attendance?.checkIn && attendance?.checkOut && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold shrink-0 px-2 py-1 bg-emerald-50 dark:bg-emerald-950 rounded-full">
              {calculateHours(attendance.checkIn, attendance.checkOut)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface HourlyInstructorControlsProps {
  instructorId: number;
  attendance?: InstructorAttendanceState;
  saving: boolean;
  onStatusChange: (instructorId: number, status: string) => void;
  onClock: (instructorId: number, field: InstructorClockField) => void;
}

function HourlyInstructorControls({
  instructorId,
  attendance,
  saving,
  onStatusChange,
  onClock,
}: HourlyInstructorControlsProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        type="button"
        onClick={() => onClock(instructorId, 'checkIn')}
        disabled={saving}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
          attendance?.checkIn
            ? 'bg-green-500 text-white'
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        )}
      >
        {attendance?.checkIn ? `출근 ${attendance.checkIn}` : '출근'}
      </button>
      <button
        type="button"
        onClick={() => onClock(instructorId, 'checkOut')}
        disabled={saving || !attendance?.checkIn}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
          attendance?.checkOut
            ? 'bg-blue-500 text-white'
            : attendance?.checkIn
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {attendance?.checkOut ? `퇴근 ${attendance.checkOut}` : '퇴근'}
      </button>
      <button
        type="button"
        onClick={() => onStatusChange(instructorId, 'absent')}
        disabled={saving}
        className={cn(
          'px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
          attendance?.status === 'absent'
            ? 'bg-red-500 text-white'
            : 'bg-background text-muted-foreground hover:bg-muted/80'
        )}
      >
        결근
      </button>
    </div>
  );
}
