import { cn } from '@/lib/utils/cn';
import { EXPENSE_CATEGORY_LABELS } from './expenses-constants';
import type { Expense } from './expenses-types';
import { isRefundPendingExpense } from './expenses-utils';

interface ExpenseCategoryBadgeProps {
  expense: Expense;
}

export function ExpenseCategoryBadge({ expense }: ExpenseCategoryBadgeProps) {
  const isPending = isRefundPendingExpense(expense);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span
        className={cn(
          'rounded-md border border-border bg-muted/35 px-2 py-1 text-xs font-medium text-foreground',
          isPending && 'border-amber-300 bg-amber-50 text-amber-800'
        )}
      >
        {EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
      </span>
      {expense.category === 'salary' && expense.instructor_name ? (
        <span className="truncate text-sm font-medium text-foreground">({expense.instructor_name})</span>
      ) : null}
    </div>
  );
}
