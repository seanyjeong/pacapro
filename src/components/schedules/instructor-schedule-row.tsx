import { Check, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { InstructorScheduleSlotConfig } from './instructor-schedule-constants';
import type {
  InstructorScheduleInstructor,
  InstructorScheduleSelection,
} from './instructor-schedule-types';

interface Props {
  activeSlotInfo: InstructorScheduleSlotConfig;
  instructor: InstructorScheduleInstructor;
  selection?: InstructorScheduleSelection;
  onToggle: (instructor: InstructorScheduleInstructor) => void;
  onTimeChange: (instructorId: number, field: 'startTime' | 'endTime', value: string) => void;
}

export function InstructorScheduleRow({
  activeSlotInfo,
  instructor,
  selection,
  onToggle,
  onTimeChange,
}: Props) {
  const isSelected = Boolean(selection?.selected);
  const isHourly = instructor.salary_type === 'hourly';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border p-3 transition-all',
        isSelected
          ? `${activeSlotInfo.bgColor} ${activeSlotInfo.darkBgColor} border-current`
          : 'border-border bg-card hover:border-muted-foreground'
      )}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={() => onToggle(instructor)}
          className="flex flex-1 items-center gap-3 text-left"
          type="button"
        >
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              isSelected ? 'bg-white dark:bg-gray-800' : 'bg-muted'
            )}
          >
            {isSelected ? (
              <Check className={cn('h-4 w-4', activeSlotInfo.color)} />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <span className="font-medium">{instructor.name}</span>
            {isHourly && (
              <Badge variant="outline" className="ml-2 border-orange-200 bg-orange-50 text-xs text-orange-700">
                시급제
              </Badge>
            )}
          </div>
        </button>
      </div>

      {isSelected && isHourly && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <TimeInput
                value={selection?.startTime || ''}
                onChange={(value) => onTimeChange(instructor.id, 'startTime', value)}
              />
              <span className="shrink-0 text-muted-foreground">~</span>
              <TimeInput
                value={selection?.endTime || ''}
                onChange={(value) => onTimeChange(instructor.id, 'endTime', value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Input
      type="time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-24 shrink-0 text-sm"
    />
  );
}
