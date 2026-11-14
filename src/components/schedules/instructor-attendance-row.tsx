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
        'rounded-xl p-4 transition-colors',
        isChecked ? 'bg-primary-soft' : 'bg-muted'
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full font-medium',
              isChecked ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
            )}
          >
            {instructor.name.charAt(0)}
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground">{instructor.name}</p>
            <p className="text-sm text-muted-foreground">
              {isChecked && edited ? INSTRUCTOR_ATTENDANCE_STATUS_LABELS[edited.status] : '미체크'}
            </p>
          </div>
        </div>

        {isChecked && edited && (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-sm font-semibold',
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
              'h-11 rounded-xl px-2 text-[15px] font-bold transition-colors',
              edited?.status === status
                ? INSTRUCTOR_ATTENDANCE_STATUS_COLORS[status]
                : 'bg-card text-secondary-foreground hover:text-foreground'
            )}
            onClick={() => onStatusChange(instructor.id, status)}
          >
            {INSTRUCTOR_ATTENDANCE_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {isChecked && (edited?.status === 'present' || edited?.status === 'late') && (
        <div className="mt-3 grid grid-cols-2 gap-3">
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
        className="h-11 w-full rounded-xl bg-card px-3 text-[15px] text-foreground outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
