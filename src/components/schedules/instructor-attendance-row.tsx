import { cn } from '@/lib/utils';
import {
  INSTRUCTOR_ATTENDANCE_STATUSES,
  INSTRUCTOR_ATTENDANCE_STATUS_COLORS,
  INSTRUCTOR_ATTENDANCE_STATUS_LABELS,
} from './instructor-attendance-constants';
import type {
  EditedInstructorAttendance,
  InstructorAttendanceStatus,
  InstructorOption,
} from './instructor-attendance-types';

interface Props {
  edited?: EditedInstructorAttendance;
  instructor: InstructorOption;
  onStatusChange: (instructorId: number, status: InstructorAttendanceStatus) => void;
  onTimeChange: (instructorId: number, field: 'checkInTime' | 'checkOutTime', value: string) => void;
}

export function InstructorAttendanceRow({
  edited,
  instructor,
  onStatusChange,
  onTimeChange,
}: Props) {
  const isChecked = Boolean(edited);

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        isChecked ? 'border-primary-300 bg-primary-50/50 dark:bg-primary-950/50' : 'border-border'
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full font-medium',
              isChecked ? 'bg-primary text-primary-foreground' : 'bg-gray-400 text-white'
            )}
          >
            {instructor.name.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-foreground">{instructor.name}</p>
            <p className="text-sm text-muted-foreground">
              {isChecked && edited ? INSTRUCTOR_ATTENDANCE_STATUS_LABELS[edited.status] : '미체크'}
            </p>
          </div>
        </div>

        {isChecked && edited && (
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium',
              INSTRUCTOR_ATTENDANCE_STATUS_COLORS[edited.status]
            )}
          >
            {INSTRUCTOR_ATTENDANCE_STATUS_LABELS[edited.status]}
          </span>
        )}
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {INSTRUCTOR_ATTENDANCE_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-all',
              edited?.status === status
                ? INSTRUCTOR_ATTENDANCE_STATUS_COLORS[status]
                : 'border-border bg-card text-muted-foreground hover:bg-muted'
            )}
            onClick={() => onStatusChange(instructor.id, status)}
          >
            {INSTRUCTOR_ATTENDANCE_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {isChecked && (edited?.status === 'present' || edited?.status === 'late') && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
          <TimeInput
            label="출근 시간"
            value={edited?.checkInTime || ''}
            onChange={(value) => onTimeChange(instructor.id, 'checkInTime', value)}
          />
          <TimeInput
            label="퇴근 시간"
            value={edited?.checkOutTime || ''}
            onChange={(value) => onTimeChange(instructor.id, 'checkOutTime', value)}
          />
        </div>
      )}
    </div>
  );
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input
        type="time"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
