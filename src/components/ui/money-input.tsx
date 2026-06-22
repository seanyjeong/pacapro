"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface MoneyInputProps {
  value: number | undefined;
  onChange: (n: number) => void;
  placeholder?: string;
  suffix?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      onChange,
      placeholder = "0",
      suffix = "원",
      className,
      required,
      disabled,
      id,
      name,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const display = !value ? "" : value.toLocaleString();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, "");
      onChange(raw === "" ? 0 : Number(raw));
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          id={id}
          name={name}
          aria-label={ariaLabel}
          className={cn(
            "w-full px-3 py-2 pr-10 border border-border bg-background text-foreground rounded-md text-right",
            className
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";
