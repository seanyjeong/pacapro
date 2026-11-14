interface IncomeSelectProps {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

export function IncomeSelect({ id, label, value, options, onChange }: IncomeSelectProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-secondary-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-transparent bg-muted px-4 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
