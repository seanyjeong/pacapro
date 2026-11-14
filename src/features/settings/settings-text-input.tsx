import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { SETTINGS_FIELD_CLASS } from './settings-constants';

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
      <label htmlFor={inputId} className="block text-sm font-semibold text-secondary-foreground">
        {label}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(SETTINGS_FIELD_CLASS, className)}
        {...props}
      />
      {helperText ? <p className="text-[13px] text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
