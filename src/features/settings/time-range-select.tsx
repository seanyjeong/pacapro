import { SETTINGS_FIELD_CLASS, TIME_OPTIONS } from './settings-constants';
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
    <div className="rounded-xl bg-muted p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn('text-[15px] font-bold', tone)}>{label}</span>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-secondary-foreground">
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
        <div className="mt-3 flex h-11 items-center rounded-xl bg-card px-4 text-[13px] text-muted-foreground">
          이 시간대에는 수업을 운영하지 않아요.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <select
            aria-label={`${label} 시작 시간`}
            value={range.start}
            onChange={(event) => onChange('start', event.target.value)}
            className={cn(SETTINGS_FIELD_CLASS, 'min-w-0 bg-card px-3')}
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
            className={cn(SETTINGS_FIELD_CLASS, 'min-w-0 bg-card px-3')}
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
