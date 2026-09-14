import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type PaymentSortKey = 'student' | 'billing' | 'amount' | 'due' | 'status';
export type SortDir = 'asc' | 'desc';

export function PaymentSortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  column: PaymentSortKey;
  sortKey: PaymentSortKey | null;
  sortDir: SortDir;
  onSort: (key: PaymentSortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      className={cn('px-3 py-3 text-left font-medium text-muted-foreground', className)}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-foreground' : 'text-muted-foreground/70')} />
      </button>
    </th>
  );
}
