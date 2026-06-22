import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface SettingsTextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  helperText?: string;
}

export function SettingsTextInput({
  label,
  value,
  onValueChange,
  helperText,
  className,
  id,
  ...props
}: SettingsTextInputProps) {
  const inputId = id || props.name || label;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground',
          'outline-none transition-colors placeholder:text-muted-foreground/70',
          'focus:border-foreground/30 focus:ring-2 focus:ring-ring/25',
          className
        )}
        {...props}
      />
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
