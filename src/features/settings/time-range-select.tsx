import { TIME_OPTIONS } from './settings-constants';
import type { TimeRangePart } from './settings-types';
import { parseTimeRange } from './settings-utils';
import { cn } from '@/lib/utils/cn';

interface TimeRangeSelectProps {
  label: string;
  value: string;
  tone: string;
  onChange: (part: TimeRangePart, value: string) => void;
  onNoClassChange: (isNoClass: boolean) => void;
}

export function TimeRangeSelect({ label, value, tone, onChange, onNoClassChange }: TimeRangeSelectProps) {
  const isNoClass = value === '-';
  const range = parseTimeRange(value);

  return (
    <div className={cn('rounded-lg border p-4', tone)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            aria-label={`${label} 수업 없음`}
            checked={isNoClass}
            onChange={(event) => onNoClassChange(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>수업 없음</span>
        </label>
      </div>
      {isNoClass ? (
        <div className="mt-3 flex h-10 items-center rounded-md border border-current/15 bg-background/70 px-3 text-xs">
          이 시간대에는 수업을 운영하지 않습니다.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <select
            aria-label={`${label} 시작 시간`}
            value={range.start}
            onChange={(event) => onChange('start', event.target.value)}
            className="h-10 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            className="h-10 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
