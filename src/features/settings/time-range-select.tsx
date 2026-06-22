import { TIME_OPTIONS } from './settings-constants';
import type { TimeRangePart } from './settings-types';
import { parseTimeRange } from './settings-utils';
import { cn } from '@/lib/utils/cn';

interface TimeRangeSelectProps {
  label: string;
  value: string;
  tone: string;
  onChange: (part: TimeRangePart, value: string) => void;
}

export function TimeRangeSelect({ label, value, tone, onChange }: TimeRangeSelectProps) {
  const range = parseTimeRange(value);

  return (
    <div className={cn('rounded-lg border p-4', tone)}>
      <label className="block text-sm font-semibold">{label}</label>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <select
          aria-label={`${label} 시작 시간`}
          value={range.start}
          onChange={(event) => onChange('start', event.target.value)}
          className="h-10 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none"
        >
          {TIME_OPTIONS.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">~</span>
        <select
          aria-label={`${label} 종료 시간`}
          value={range.end}
          onChange={(event) => onChange('end', event.target.value)}
          className="h-10 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none"
        >
          {TIME_OPTIONS.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
