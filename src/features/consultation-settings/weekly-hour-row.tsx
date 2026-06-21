import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { WeeklyHour } from '@/lib/types/consultation';
import { DAY_LABELS } from '@/lib/types/consultation';
import { timeLabel } from './consultation-settings-utils';

interface WeeklyHourRowProps {
  hour: WeeklyHour;
  timeOptions: string[];
  onUpdateHour: <K extends keyof WeeklyHour>(dayOfWeek: number, field: K, value: WeeklyHour[K]) => void;
}

export function WeeklyHourRow({ hour, timeOptions, onUpdateHour }: WeeklyHourRowProps) {
  const isWeekend = hour.dayOfWeek === 0 || hour.dayOfWeek === 6;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className={`w-12 text-center font-medium ${isWeekend ? 'text-red-500' : ''}`}>
        {DAY_LABELS[hour.dayOfWeek]}
      </div>
      <Switch
        checked={hour.isAvailable}
        onCheckedChange={(checked) => onUpdateHour(hour.dayOfWeek, 'isAvailable', checked)}
      />
      {hour.isAvailable ? (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={hour.startTime || '09:00:00'}
            onValueChange={(value) => onUpdateHour(hour.dayOfWeek, 'startTime', value)}
          >
            <SelectTrigger className="w-28">
              <span>{timeLabel(hour.startTime || '09:00:00')}</span>
            </SelectTrigger>
            <SelectContent>
              {timeOptions.slice(0, -1).map((time) => (
                <SelectItem key={time} value={time}>{timeLabel(time)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>~</span>
          <Select
            value={hour.endTime || '18:00:00'}
            onValueChange={(value) => onUpdateHour(hour.dayOfWeek, 'endTime', value)}
          >
            <SelectTrigger className="w-28">
              <span>{timeLabel(hour.endTime || '18:00:00')}</span>
            </SelectTrigger>
            <SelectContent>
              {timeOptions.slice(1).map((time) => (
                <SelectItem key={time} value={time}>{timeLabel(time)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <span className="text-muted-foreground">휴무</span>
      )}
    </div>
  );
}
