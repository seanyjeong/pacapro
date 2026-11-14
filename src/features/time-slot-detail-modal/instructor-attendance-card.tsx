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
    <div className="space-y-3 rounded-xl bg-muted p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
            <UserCog className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <span className="truncate text-[15px] font-semibold text-foreground">{instructor.name}</span>
            {isHourly && (
              <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
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
          <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
            {INSTRUCTOR_ATTENDANCE_STATUS.map((status) => {
              const isSelected = attendance?.status === status.value;
              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => onStatusChange(instructor.id, status.value)}
                  disabled={saving}
                  className={cn(
                    'h-11 rounded-xl px-3.5 text-sm font-bold transition-colors active:scale-95',
                    isSelected
                      ? status.color
                      : 'bg-card text-secondary-foreground hover:text-foreground'
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
        <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-11">
          <Input
            type="time"
            value={attendance?.checkIn || ''}
            onChange={(event) => onTimeChange(instructor.id, 'checkIn', event.target.value)}
            onBlur={() => onTimeSave(instructor.id)}
            className="h-10 w-28 bg-card text-sm"
            aria-label={`${instructor.name} 출근 시간`}
          />
          <span className="text-muted-foreground shrink-0">~</span>
          <Input
            type="time"
            value={attendance?.checkOut || ''}
            onChange={(event) => onTimeChange(instructor.id, 'checkOut', event.target.value)}
            onBlur={() => onTimeSave(instructor.id)}
            className="h-10 w-28 bg-card text-sm"
            aria-label={`${instructor.name} 퇴근 시간`}
          />
          {attendance?.checkIn && attendance?.checkOut && (
            <span className="text-xs text-success font-semibold shrink-0 px-2 py-1 bg-success-soft rounded-full">
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
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onClock(instructorId, 'checkIn')}
        disabled={saving}
        className={cn(
          'h-11 rounded-xl px-3.5 text-sm font-bold transition-colors',
          attendance?.checkIn
            ? 'bg-success text-success-foreground'
            : 'bg-success-soft text-success hover:bg-success/20'
        )}
      >
        {attendance?.checkIn ? `출근 ${attendance.checkIn}` : '출근'}
      </button>
      <button
        type="button"
        onClick={() => onClock(instructorId, 'checkOut')}
        disabled={saving || !attendance?.checkIn}
        className={cn(
          'h-11 rounded-xl px-3.5 text-sm font-bold transition-colors',
          attendance?.checkOut
            ? 'bg-primary text-primary-foreground'
            : attendance?.checkIn
              ? 'bg-primary-soft text-primary hover:bg-primary/20'
              : 'cursor-not-allowed bg-card text-muted-foreground'
        )}
      >
        {attendance?.checkOut ? `퇴근 ${attendance.checkOut}` : '퇴근'}
      </button>
      <button
        type="button"
        onClick={() => onStatusChange(instructorId, 'absent')}
        disabled={saving}
        className={cn(
          'h-11 rounded-xl px-3.5 text-sm font-bold transition-colors',
          attendance?.status === 'absent'
            ? 'bg-destructive-soft text-destructive ring-2 ring-inset ring-destructive/50'
            : 'bg-card text-muted-foreground hover:text-foreground'
        )}
      >
        결근
      </button>
    </div>
  );
}
