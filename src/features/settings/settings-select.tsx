import { cn } from '@/lib/utils/cn';
import type { SettingsSelectOption } from './settings-types';

interface SettingsSelectProps<T extends string | number> {
  label: string;
  value: T;
  options: SettingsSelectOption<T>[];
  onValueChange: (value: T) => void;
  helperText?: string;
  id?: string;
  className?: string;
}

export function SettingsSelect<T extends string | number>({
  label,
  value,
  options,
  onValueChange,
  helperText,
  id,
  className,
}: SettingsSelectProps<T>) {
  const selectId = id || label;

  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={selectId}
        value={String(value)}
        onChange={(event) => {
          const selected = options.find((option) => String(option.value) === event.target.value);
          if (selected) onValueChange(selected.value);
        }}
        className={cn(
          'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground',
          'outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-ring/25',
          className
        )}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
