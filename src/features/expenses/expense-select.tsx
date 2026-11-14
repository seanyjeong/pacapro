import { cn } from '@/lib/utils/cn';
import { FILTER_FIELD_CLASS } from './expenses-filter-bar';

interface ExpenseSelectProps {
  id?: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

export function ExpenseSelect({ id, label, value, options, onChange }: ExpenseSelectProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-secondary-foreground">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FILTER_FIELD_CLASS, 'w-full px-4')}
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
