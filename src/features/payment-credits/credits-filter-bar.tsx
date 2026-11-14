import { AlertCircle, Layers3, RotateCcw, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  onResetFilters: () => void;
}

export function CreditsFilterBar({ filters, onStatusChange, onTypeChange, onResetFilters }: CreditsFilterBarProps) {
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-4 sm:px-5"
      role="search"
      aria-label="크레딧 필터"
    >
      <div className="min-w-0 flex-1 sm:w-[160px] sm:flex-none">
        <Select value={filters.status} onValueChange={(value) => onStatusChange(value as CreditStatusFilter)}>
          <SelectTrigger aria-label="상태 필터" className="h-11 w-full">
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
      </div>

      <div className="min-w-0 flex-1 sm:w-[160px] sm:flex-none">
        <Select value={filters.type} onValueChange={(value) => onTypeChange(value as CreditTypeFilter)}>
          <SelectTrigger aria-label="타입 필터" className="h-11 w-full">
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

      <div className="flex min-w-0 basis-full flex-wrap items-center gap-2 sm:basis-auto">
        <Button type="button" size="sm" variant={filters.status === 'pending' ? 'secondary' : 'outline'} onClick={() => onStatusChange('pending')}>
          <AlertCircle className="h-4 w-4" />
          대기 크레딧 보기
        </Button>
        <Button type="button" size="sm" variant={filters.status === 'partial' ? 'secondary' : 'outline'} onClick={() => onStatusChange('partial')}>
          <WalletCards className="h-4 w-4" />
          부분적용 보기
        </Button>
        <Button type="button" size="sm" variant={filters.type === 'carryover' ? 'secondary' : 'outline'} onClick={() => onTypeChange('carryover')}>
          <Layers3 className="h-4 w-4" />
          이월 크레딧 보기
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onResetFilters}>
          <RotateCcw className="h-4 w-4" />
          전체 크레딧 보기
        </Button>
      </div>
    </div>
  );
}
