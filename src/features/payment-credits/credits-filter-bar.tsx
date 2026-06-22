import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CREDIT_STATUS_OPTIONS, CREDIT_TYPE_OPTIONS } from './credits-constants';
import type { CreditFilters, CreditStatusFilter, CreditTypeFilter } from './credits-types';

interface CreditsFilterBarProps {
  filters: CreditFilters;
  onStatusChange: (value: CreditStatusFilter) => void;
  onTypeChange: (value: CreditTypeFilter) => void;
}

export function CreditsFilterBar({ filters, onStatusChange, onTypeChange }: CreditsFilterBarProps) {
  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-none" aria-label="크레딧 필터">
      <div className="grid gap-2 sm:grid-cols-2 lg:w-fit">
        <Select value={filters.status} onValueChange={(value) => onStatusChange(value as CreditStatusFilter)}>
          <SelectTrigger aria-label="상태 필터" className="h-10 w-full sm:w-[160px]">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            {CREDIT_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(value) => onTypeChange(value as CreditTypeFilter)}>
          <SelectTrigger aria-label="타입 필터" className="h-10 w-full sm:w-[160px]">
            <SelectValue placeholder="타입 필터" />
          </SelectTrigger>
          <SelectContent>
            {CREDIT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
